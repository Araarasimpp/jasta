// Edge Function telegram-config: conecta el bot de Telegram desde la app.
//
// POST { token } con la sesión de un admin (Authorization: Bearer …):
//  1. Revisa que el token sea de un bot (getMe).
//  2. Le dice a Telegram que mande los mensajes a telegram-bot (setWebhook),
//     de a uno en orden (max_connections = 1) y con un secreto propio.
//  3. Guarda el token y el secreto en privado.telegram_config (la app no
//     puede leer ese esquema; el token nunca vuelve al navegador).
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

/** El gateway ya verificó la firma del JWT (verify_jwt); aquí solo se leen sus datos */
function claims(req: Request): Record<string, unknown> | null {
  const t = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const parte = t.split('.')[1];
  if (!parte) return null;
  try {
    return JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

async function esAdmin(c: Record<string, unknown>): Promise<boolean> {
  return await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify(c)}, true)`;
    const [f] = await tx`select public.tiene_rol('admin') as ok`;
    return !!f?.ok;
  });
}

async function api(token: string, metodo: string, datos: Record<string, unknown> = {}): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(datos),
  });
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const c = claims(req);
  if (!c?.sub || !(await esAdmin(c))) return json({ error: 'Solo el admin puede conectar el bot' }, 403);

  let token = '';
  try {
    token = String((await req.json()).token ?? '').trim();
  } catch {
    /* cuerpo vacío */
  }
  if (!/^\d+:[\w-]{30,}$/.test(token)) return json({ error: 'Ese no parece un token de bot. Cópialo completo desde @BotFather.' }, 400);

  const yo = await api(token, 'getMe');
  if (!yo.ok) return json({ error: 'Telegram no reconoce ese token. Revisa que esté completo.' }, 400);

  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const secreto = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/telegram-bot`;

  // Primero se guarda (el bot necesita el secreto para aceptar lo que llegue) y luego se conecta
  await sql`select public.telegram_config_guardar(${token}, ${secreto}, ${yo.result.username})`;
  const w = await api(token, 'setWebhook', {
    url,
    secret_token: secreto,
    max_connections: 1,
    allowed_updates: ['message'],
    drop_pending_updates: true,
  });
  if (!w.ok) return json({ error: 'Telegram no aceptó la conexión: ' + (w.description ?? 'error desconocido') }, 502);

  await api(token, 'setMyCommands', {
    commands: [
      { command: 'ruta', description: 'Lo que lleva el mensajero de este grupo' },
      { command: 'vincular', description: 'Vincular este grupo con el código de la app' },
      { command: 'ayuda', description: 'Cómo funciona' },
    ],
  });

  return json({ bot: yo.result.username });
});
