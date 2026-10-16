// Edge Function enviar-push: avisos con la app cerrada (Web Push).
//
//  GET  → { publicKey }: la clave pública VAPID con la que el navegador suscribe
//         el dispositivo. Las claves se crean solas la primera vez y se guardan
//         en privado.push_config (la app no puede leer ese esquema).
//  POST → { id } de un aviso (public.notificaciones). Lo llama la base de datos
//         (trigger privado.enviar_push, con pg_net) con el encabezado
//         x-push-secreto; manda el aviso a todos los dispositivos de esa
//         persona y borra las suscripciones que ya no existen.
import webpush from 'npm:web-push@3.6.7';
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface Config {
  public_key: string;
  private_key: string;
  secreto: string;
}

function base64Url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Claves VAPID: se generan una sola vez (P-256) y quedan guardadas */
async function config(): Promise<Config> {
  const [fila] = await sql<Config[]>`select public_key, private_key, secreto from privado.push_config where id`;
  if (fila?.public_key && fila?.private_key) return fila;

  const par = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const publica = base64Url(new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey)));
  const privada = (await crypto.subtle.exportKey('jwk', par.privateKey)).d!;
  // Si dos llamadas llegan a la vez, gana la primera y ambas usan la misma
  await sql`update privado.push_config set public_key = ${publica}, private_key = ${privada} where id and public_key is null`;
  const [guardada] = await sql<Config[]>`select public_key, private_key, secreto from privado.push_config where id`;
  return guardada;
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const cfg = await config();

    if (req.method === 'GET') return json({ publicKey: cfg.public_key });
    if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

    // Solo la base de datos conoce el secreto
    if (!iguales(req.headers.get('x-push-secreto') ?? '', cfg.secreto)) return json({ error: 'No autorizado' }, 401);

    const { id } = await req.json();
    const [aviso] = await sql`
      select id, usuario_id, tipo, titulo, cuerpo, url, pedido_id from public.notificaciones where id = ${id}`;
    if (!aviso) return json({ enviados: 0 });

    const subs = await sql`select id, endpoint, p256dh, auth from public.push_suscripciones where usuario_id = ${aviso.usuario_id}`;
    if (!subs.length) return json({ enviados: 0 });

    webpush.setVapidDetails('https://jastatechnology.com', cfg.public_key, cfg.private_key);
    const carga = JSON.stringify({
      titulo: aviso.titulo,
      cuerpo: aviso.cuerpo ?? '',
      url: aviso.url ?? '/',
      // Los mensajes de un mismo pedido se reemplazan entre sí en vez de amontonarse
      tag: aviso.tipo === 'mensaje' && aviso.pedido_id ? `chat-${aviso.pedido_id}` : aviso.id,
    });

    let enviados = 0;
    const vencidas: number[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, {
            TTL: 60 * 60 * 12,
            urgency: 'high',
          });
          enviados++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          // 404/410: el navegador ya no tiene esa suscripción
          if (status === 404 || status === 410) vencidas.push(s.id);
          else console.error('push', status, (e as Error).message);
        }
      })
    );
    if (vencidas.length) await sql`delete from public.push_suscripciones where id in ${sql(vencidas)}`;
    return json({ enviados, borradas: vencidas.length });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
