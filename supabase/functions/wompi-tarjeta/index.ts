// Edge Function wompi-tarjeta: pago con tarjeta dentro de la tienda (sin salir a Wompi), con tarjetas guardadas
// y cuotas, para clientes con cuenta.
//
//  POST { accion: 'llave' }  → { public_key, terminos }  (llave pública para tokenizar en el navegador y el
//                                enlace de los términos de Wompi que el cliente acepta)
//  POST { accion: 'pagar', codigo, cuotas, tarjeta_id }                     → cobra una tarjeta guardada
//  POST { accion: 'pagar', codigo, cuotas, token, guardar, tarjeta: {...} } → cobra una tarjeta nueva (y la guarda)
//       (con el token de sesión del cliente en Authorization)
//
// El número de la tarjeta nunca pasa por aquí: el navegador lo manda directo a Wompi y recibe un token.
// El monto sale siempre de la base de datos. Las llaves están en Vault (wompi_private_key, wompi_public_key,
// wompi_integrity_secret).
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });
const API = 'https://production.wompi.co/v1';
const SUPA = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FINALES = ['APPROVED', 'DECLINED', 'VOIDED', 'ERROR'];

async function secreto(nombre: string): Promise<string | null> {
  const [r] = await sql`select public.wompi_secreto(${nombre}) as v`;
  return (r?.v as string) ?? null;
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Tokens de aceptación de Wompi (términos y tratamiento de datos), obligatorios para cobrar */
async function aceptacion(pub: string) {
  const r = await fetch(`${API}/merchants/${pub}`);
  const j = await r.json().catch(() => ({}));
  const d = j?.data ?? {};
  return {
    acceptance_token: d.presigned_acceptance?.acceptance_token as string | undefined,
    accept_personal_auth: d.presigned_personal_data_auth?.acceptance_token as string | undefined,
    terminos: d.presigned_acceptance?.permalink as string | undefined,
    datos: d.presigned_personal_data_auth?.permalink as string | undefined,
  };
}

/** El cliente que llama (por su token de sesión) */
async function clienteDe(req: Request): Promise<{ id: number; email: string } | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const r = await fetch(`${SUPA}/auth/v1/user`, { headers: { Authorization: auth, apikey: ANON } });
  if (!r.ok) return null;
  const u = await r.json();
  if (!u?.id) return null;
  const [c] = await sql`select id, coalesce(email, ${u.email ?? ''}) as email from public.clientes_cuentas where auth_id = ${u.id}`;
  return c ? { id: Number(c.id), email: String(c.email || u.email || '') } : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const pub = await secreto('wompi_public_key');
    if (!pub) return responder({ error: 'El pago con tarjeta no está disponible' }, 503);

    if (body.accion === 'llave') {
      const a = await aceptacion(pub);
      const activo = !!(await secreto('wompi_integrity_secret'));
      return responder({ public_key: pub, terminos: a.terminos ?? null, datos: a.datos ?? null, activo });
    }
    if (body.accion !== 'pagar') return responder({ error: 'Acción inválida' }, 400);

    const integridad = await secreto('wompi_integrity_secret');
    const privada = await secreto('wompi_private_key');
    if (!integridad || !privada) return responder({ error: 'El pago con tarjeta todavía no está activo. Elige otro medio de pago.' }, 503);

    const cli = await clienteDe(req);
    if (!cli) return responder({ error: 'Inicia sesión con tu cuenta para pagar con tarjeta' }, 401);
    if (!cli.email) return responder({ error: 'Tu cuenta no tiene correo' }, 400);

    const codigo = String(body.codigo ?? '');
    if (!UUID.test(codigo)) return responder({ error: 'Pedido inválido' }, 400);
    const cuotas = Math.max(1, Math.min(36, Math.round(Number(body.cuotas) || 1)));

    const [w] = await sql`
      select id, estado, pago, pago_estado, motivo, subtotal, valor_domicilio, recargo, cliente_cuenta_id, wompi_link
      from public.pedidos_web where codigo = ${codigo}`;
    if (!w) return responder({ error: 'Ese pedido no existe' }, 404);
    if (Number(w.cliente_cuenta_id) !== cli.id) return responder({ error: 'Ese pedido no es de tu cuenta' }, 403);
    if (w.pago_estado === 'aprobado') return responder({ estado: 'APPROVED', pagado: true });
    // Un cobro con tarjeta de hace menos de 90 s todavía se está procesando: no se cobra otra vez
    const previo = /^tx:JWC-\d+-(\d+)$/.exec(String(w.wompi_link ?? ''));
    if (previo && w.pago_estado === 'pendiente' && Date.now() - Number(previo[1]) < 90_000) {
      return responder({ error: 'Ya estamos procesando tu pago. Espera un momento y revisa Mis compras.' }, 409);
    }
    const autoCancelado = w.estado === 'cancelado' && w.motivo === 'No se completó el pago en línea';
    if (w.pago !== 'en_linea' || !(w.estado === 'por_pagar' || autoCancelado)) return responder({ error: 'Este pedido ya no se puede pagar en línea' }, 409);
    if (autoCancelado) {
      await sql`update public.pedidos_web set estado = 'por_pagar', motivo = null, atendido_por = null, atendido_at = null, created_at = now() where id = ${w.id}`;
    }

    const total = Math.round(Number(w.subtotal) + Number(w.valor_domicilio) + Number(w.recargo));
    if (!(total > 0)) return responder({ error: 'El pedido no tiene valor' }, 400);
    const centavos = total * 100;

    const acep = await aceptacion(pub);
    if (!acep.acceptance_token || !acep.accept_personal_auth) return responder({ error: 'No se pudo conectar con Wompi. Intenta otra vez.' }, 502);
    const H = { Authorization: `Bearer ${privada}`, 'Content-Type': 'application/json' };

    // ---------------------------------------------------------------- ¿Con qué tarjeta?
    let fuente: number | null = null;
    let token: string | null = null;
    if (body.tarjeta_id) {
      const [t] = await sql`select wompi_fuente from public.clientes_tarjetas where id = ${Number(body.tarjeta_id)} and cliente_id = ${cli.id} and activa`;
      if (!t) return responder({ error: 'Esa tarjeta ya no está guardada' }, 404);
      fuente = Number(t.wompi_fuente);
    } else {
      token = String(body.token ?? '');
      if (!/^tok_[\w-]{5,120}$/.test(token)) return responder({ error: 'Revisa los datos de la tarjeta' }, 400);
      if (body.guardar) {
        // Wompi guarda la tarjeta (fuente de pago) y nos da su número de referencia
        const r = await fetch(`${API}/payment_sources`, {
          method: 'POST', headers: H,
          body: JSON.stringify({ type: 'CARD', token, customer_email: cli.email, acceptance_token: acep.acceptance_token, accept_personal_auth: acep.accept_personal_auth }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.data?.id) {
          fuente = Number(j.data.id);
          const t = (body.tarjeta ?? {}) as Record<string, unknown>;
          const limpio = (v: unknown, n: number) => (v == null ? null : String(v).replace(/[^\w ]/g, '').slice(0, n) || null);
          await sql`insert into public.clientes_tarjetas (cliente_id, wompi_fuente, marca, ultimos4, titular, exp_mes, exp_anio)
            values (${cli.id}, ${fuente}, ${limpio(t.marca, 20)}, ${limpio(t.ultimos4, 4)}, ${limpio(t.titular, 60)}, ${limpio(t.exp_mes, 2)}, ${limpio(t.exp_anio, 4)})`;
          token = null;
        } else {
          // Si no se pudo guardar, igual se cobra con el token (solo esta vez)
          console.error('Wompi payment_sources', r.status, JSON.stringify(j));
        }
      }
    }

    // ---------------------------------------------------------------- Cobro
    const referencia = `JWC-${w.id}-${Date.now()}`;
    const firma = await sha256(`${referencia}${centavos}COP${integridad}`);
    const tx: Record<string, unknown> = {
      amount_in_cents: centavos, currency: 'COP', signature: firma, customer_email: cli.email, reference: referencia,
      acceptance_token: acep.acceptance_token, accept_personal_auth: acep.accept_personal_auth,
    };
    if (fuente) {
      tx.payment_source_id = fuente;
      tx.payment_method = { installments: cuotas };
    } else {
      tx.payment_method = { type: 'CARD', token, installments: cuotas };
    }
    // El pedido queda amarrado a esta referencia: así el aviso de Wompi (wompi-eventos) lo encuentra
    await sql`update public.pedidos_web set wompi_link = ${'tx:' + referencia}, wompi_link_vence = null, pago_estado = 'pendiente' where id = ${w.id}`;
    const r = await fetch(`${API}/transactions`, { method: 'POST', headers: H, body: JSON.stringify(tx) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.data?.id) {
      console.error('Wompi transactions', r.status, JSON.stringify(j));
      const msg = j?.error?.messages ? 'Wompi no aceptó la tarjeta. Revisa los datos o usa otra.' : 'No se pudo hacer el cobro. Intenta otra vez.';
      return responder({ error: msg }, 502);
    }
    let t = j.data;
    // Espera el resultado (casi siempre llega en pocos segundos)
    for (let i = 0; i < 12 && !FINALES.includes(t.status); i++) {
      await new Promise((ok) => setTimeout(ok, 2000));
      const rr = await fetch(`${API}/transactions/${encodeURIComponent(t.id)}`);
      if (rr.ok) t = (await rr.json()).data ?? t;
    }
    if (FINALES.includes(t.status)) {
      await sql`select public.wompi_registrar(${'tx:' + referencia}, ${t.id}, ${t.status}, ${t.amount_in_cents}, ${'CARD'})`;
    }
    return responder({ estado: t.status, mensaje: t.status_message ?? null, pagado: t.status === 'APPROVED', guardada: !!fuente && !body.tarjeta_id });
  } catch (e) {
    console.error(e);
    return responder({ error: 'No se pudo hacer el cobro. Intenta otra vez.' }, 500);
  }
});
