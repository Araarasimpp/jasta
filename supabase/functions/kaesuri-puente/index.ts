// Puente para que el mensajero entregue pedidos de Jasta desde la app de Variedades JYB (Kaesuri).
// Es el espejo de jasta-puente (en el proyecto de Kaesuri).
//
// La app de Kaesuri llama aquí con su propia sesión (Authorization: Bearer <token de Kaesuri>).
// Se valida ese token contra Kaesuri, se toma el correo y se busca el mensajero con ese correo
// en Jasta. Todo lo demás lo hacen las funciones kaesuri_* de la base (solo service_role).
//
// Se despliega con verify_jwt = false: el token no es de este proyecto y se valida aquí.
//
// POST { accion: 'resumen' }
// POST { accion: 'entregar', pedido_id, tipo, efectivo, transferencia, comprobantes? }  comprobantes = rutas del bucket de Kaesuri
// POST { accion: 'cerrar_cuadre' }
// POST { accion: 'entregadas', desde?, hasta? }  (ISO)
import { createClient } from 'npm:@supabase/supabase-js@2';

// Proyecto de Kaesuri (la llave es la pública)
const KAESURI_URL = 'https://mswqdzpsynvdanxdfidf.supabase.co';
const KAESURI_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zd3FkenBzeW52ZGFueGRmaWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODcyNTQsImV4cCI6MjEwNTI2MzI1NH0.HsrN07w2w74s2iol3csU__6Tzrbi6Z1IXYDU-fcQevI';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

/** Correo de quien tiene la sesión en Kaesuri, o null si la sesión no sirve */
async function correoKaesuri(token: string): Promise<string | null> {
  const r = await fetch(`${KAESURI_URL}/auth/v1/user`, { headers: { apikey: KAESURI_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return typeof u?.email === 'string' ? u.email : null;
}

/** Copia una foto del bucket de comprobantes de Kaesuri a la carpeta del mensajero en Jasta */
async function copiarComprobante(token: string, carpeta: string, ruta: string): Promise<string> {
  // En Kaesuri las rutas son nombres de archivo sueltos ('<pedido>-<hora>.jpg')
  if (!/^[A-Za-z0-9._-]+$/.test(ruta)) throw new Error('Comprobante no válido');
  const r = await fetch(`${KAESURI_URL}/storage/v1/object/authenticated/comprobantes/${ruta}`, {
    headers: { apikey: KAESURI_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error('No se pudo leer la foto del comprobante');
  const tipo = r.headers.get('content-type') ?? 'image/jpeg';
  const destino = `${carpeta}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ruta.split('.').pop() || 'jpg'}`;
  const { error } = await db.storage.from('comprobantes').upload(destino, await r.arrayBuffer(), { contentType: tipo, upsert: false });
  if (error) throw new Error('No se pudo guardar la foto del comprobante');
  return destino;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const email = token ? await correoKaesuri(token) : null;
  if (!email) return responder({ error: 'Tu sesión de Variedades JYB se cerró, vuelve a entrar' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return responder({ error: 'Solicitud no válida' }, 400);
  }

  try {
    if (body.accion === 'resumen') {
      const { data, error } = await db.rpc('kaesuri_resumen', { p_email: email });
      if (error) throw error;
      return responder(data);
    }

    if (body.accion === 'entregar') {
      const pedidoId = Number(body.pedido_id);
      const tipo = String(body.tipo ?? '');
      if (!Number.isInteger(pedidoId) || pedidoId <= 0) return responder({ error: 'Pedido no válido' }, 400);
      const origenes =
        (tipo === 'transferencia' || tipo === 'mixto') && Array.isArray(body.comprobantes)
          ? body.comprobantes.filter((x): x is string => typeof x === 'string' && x !== '').slice(0, 5)
          : [];
      const subidas: string[] = [];
      if (origenes.length) {
        const { data: carpeta, error } = await db.rpc('kaesuri_carpeta', { p_email: email });
        if (error) throw error;
        if (!carpeta) return responder({ error: 'Tu correo de Variedades JYB no está como mensajero en Jasta' }, 400);
        try {
          for (const o of origenes) subidas.push(await copiarComprobante(token, carpeta, o));
        } catch (e) {
          if (subidas.length) await db.storage.from('comprobantes').remove(subidas);
          throw e;
        }
      }
      const { error } = await db.rpc('kaesuri_entregar', {
        p_email: email,
        p_pedido: pedidoId,
        p_tipo: tipo,
        p_efectivo: Number(body.efectivo) || 0,
        p_transferencia: Number(body.transferencia) || 0,
        p_evidencias: subidas.map((s) => 'sb://comprobantes/' + s),
      });
      if (error) {
        if (subidas.length) await db.storage.from('comprobantes').remove(subidas);
        throw error;
      }
      return responder({ ok: true });
    }

    if (body.accion === 'cerrar_cuadre') {
      const { data, error } = await db.rpc('kaesuri_cerrar_cuadre', { p_email: email });
      if (error) throw error;
      return responder({ cuadre_id: data });
    }

    if (body.accion === 'entregadas') {
      const fecha = (v: unknown) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v : null);
      const { data, error } = await db.rpc('kaesuri_entregadas', { p_email: email, p_desde: fecha(body.desde), p_hasta: fecha(body.hasta) });
      if (error) throw error;
      return responder(data);
    }

    return responder({ error: 'Acción no válida' }, 400);
  } catch (e) {
    const mensaje = (e as { message?: string })?.message || 'No se pudo completar';
    return responder({ error: mensaje }, 400);
  }
});
