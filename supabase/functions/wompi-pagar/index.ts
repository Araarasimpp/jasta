// Edge Function wompi-pagar: pagos en línea del catálogo público con Wompi.
//
//  POST { codigo, origen }      → crea (o reutiliza) un link de pago de un solo uso por el total
//                                  del pedido web (productos + domicilio + comisión de Wompi) y devuelve { url }.
//  POST { codigo, tx }          → al volver de Wompi: consulta esa transacción en Wompi y, si es
//                                  de este pedido, registra el resultado (por si el evento tarda).
//  POST { seguimiento, origen } → link de pago de un pedido normal (cobro por link que preparó la
//  POST { seguimiento, tx }       vendedora o el admin); con tx, verifica el pago al volver.
//
// El monto siempre sale de la base de datos, nunca del navegador. Las llaves están en Vault.
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });
const API = 'https://production.wompi.co/v1';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responder = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PedidoWeb {
  id: number;
  estado: string;
  pago: string;
  pago_estado: string | null;
  motivo: string | null;
  subtotal: string;
  valor_domicilio: string;
  recargo: string;
  wompi_link: string | null;
  wompi_link_vence: Date | null;
  items: { nombre: string; cantidad: number }[];
}

async function secreto(nombre: string): Promise<string> {
  const [r] = await sql`select public.wompi_secreto(${nombre}) as v`;
  if (!r?.v) throw new Error('Falta la llave ' + nombre);
  return r.v as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    if (body.seguimiento) return await cobroPedido(body);
    const codigo = String(body.codigo ?? '');
    if (!UUID.test(codigo)) return responder({ error: 'Pedido inválido' }, 400);

    const [w] = (await sql`
      select id, estado, pago, pago_estado, motivo, subtotal, valor_domicilio, recargo, wompi_link, wompi_link_vence, items
      from public.pedidos_web where codigo = ${codigo}`) as unknown as PedidoWeb[];
    if (!w) return responder({ error: 'Ese pedido no existe' }, 404);

    // ---------------------------------------------------------------- Verificar al volver de Wompi
    if (body.tx) {
      const tx = String(body.tx);
      if (!/^[\w-]{5,80}$/.test(tx)) return responder({ error: 'Transacción inválida' }, 400);
      if (w.pago_estado === 'aprobado') return responder({ pago_estado: 'aprobado' });
      const r = await fetch(`${API}/transactions/${encodeURIComponent(tx)}`);
      if (!r.ok) return responder({ pago_estado: w.pago_estado });
      const t = (await r.json()).data;
      if (!t || !w.wompi_link || t.payment_link_id !== w.wompi_link) return responder({ error: 'Esa transacción no es de este pedido' }, 400);
      await sql`select public.wompi_registrar(${w.wompi_link}, ${t.id}, ${t.status}, ${t.amount_in_cents}, ${t.payment_method_type ?? null})`;
      const [n] = await sql`select pago_estado from public.pedidos_web where id = ${w.id}`;
      return responder({ pago_estado: n.pago_estado, status: t.status });
    }

    // ---------------------------------------------------------------- Crear el link de pago
    if (w.pago_estado === 'aprobado') return responder({ pagado: true });
    const autoCancelado = w.estado === 'cancelado' && w.motivo === 'No se completó el pago en línea';
    if (w.pago !== 'en_linea' || !(w.estado === 'por_pagar' || autoCancelado)) {
      return responder({ error: 'Este pedido ya no se puede pagar en línea' }, 409);
    }
    if (autoCancelado) {
      await sql`update public.pedidos_web set estado = 'por_pagar', motivo = null, atendido_por = null, atendido_at = null, created_at = now() where id = ${w.id}`;
    }

    // Reutiliza el link si sigue vigente y no hubo un pago rechazado
    if (w.wompi_link && w.wompi_link_vence && w.wompi_link_vence.getTime() > Date.now() + 5 * 60_000 && w.pago_estado !== 'rechazado') {
      return responder({ url: `https://checkout.wompi.co/l/${w.wompi_link}` });
    }

    const total = Math.round(Number(w.subtotal) + Number(w.valor_domicilio) + Number(w.recargo));
    if (!(total > 0)) return responder({ error: 'El pedido no tiene valor' }, 400);
    const origen = String(body.origen ?? '');
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(origen) && !/^http:\/\/localhost(:\d+)?$/.test(origen)) return responder({ error: 'Origen inválido' }, 400);
    const vence = new Date(Date.now() + 70 * 60_000);
    const productos = w.items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ');

    const r = await fetch(`${API}/payment_links`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await secreto('wompi_private_key')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Pedido #${w.id}`,
        description: (productos + ' · incluye domicilio y costo del pago en línea').slice(0, 250),
        single_use: true,
        collect_shipping: false,
        currency: 'COP',
        amount_in_cents: total * 100,
        expires_at: vence.toISOString(),
        redirect_url: `${origen}/pago/${codigo}`,
        sku: codigo,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.data?.id) {
      console.error('Wompi payment_links', r.status, JSON.stringify(j));
      return responder({ error: 'No se pudo abrir el pago en línea. Intenta otra vez o elige pagar al recibir.' }, 502);
    }
    await sql`select public.wompi_guardar_link(${codigo}::uuid, ${j.data.id}, ${vence.toISOString()}::timestamptz)`;
    await sql`update public.pedidos_web set pago_estado = 'pendiente' where id = ${w.id} and pago_estado is distinct from 'aprobado'`;
    return responder({ url: `https://checkout.wompi.co/l/${j.data.id}` });
  } catch (e) {
    console.error(e);
    return responder({ error: 'No se pudo abrir el pago en línea. Intenta otra vez.' }, 500);
  }
});

interface PedidoCobro {
  id: number;
  estado: string;
  total: string;
  cobro_recargo: string | null;
  cobro_estado: string | null;
  pagado_linea: string | null;
  wompi_link: string | null;
  wompi_link_vence: Date | null;
  wompi_link_valor: string | null;
}

/** Cobro por link de un pedido normal: el cliente lo abre desde su seguimiento o desde el link que le mandaron */
async function cobroPedido(body: Record<string, unknown>): Promise<Response> {
  const seg = String(body.seguimiento ?? '');
  if (!UUID.test(seg)) return responder({ error: 'Pedido inválido' }, 400);
  const [p] = (await sql`
    select id, estado, total, cobro_recargo, cobro_estado, pagado_linea, wompi_link, wompi_link_vence, wompi_link_valor
    from public.pedidos where seguimiento = ${seg}`) as unknown as PedidoCobro[];
  if (!p) return responder({ error: 'Ese pedido no existe' }, 404);

  if (body.tx) {
    const tx = String(body.tx);
    if (!/^[\w-]{5,80}$/.test(tx)) return responder({ error: 'Transacción inválida' }, 400);
    if (p.pagado_linea) return responder({ pagado: true });
    const r = await fetch(`${API}/transactions/${encodeURIComponent(tx)}`);
    if (!r.ok) return responder({ pagado: false });
    const t = (await r.json()).data;
    if (!t || !p.wompi_link || t.payment_link_id !== p.wompi_link) return responder({ error: 'Esa transacción no es de este pedido' }, 400);
    await sql`select public.wompi_registrar_pedido(${p.wompi_link}, ${t.id}, ${t.status}, ${t.amount_in_cents}, ${t.payment_method_type ?? null})`;
    const [n] = await sql`select pagado_linea, cobro_estado from public.pedidos where id = ${p.id}`;
    return responder({ pagado: !!n.pagado_linea, cobro_estado: n.cobro_estado, status: t.status });
  }

  if (p.pagado_linea) return responder({ pagado: true });
  if (!p.cobro_estado || p.estado === 'cancelado') return responder({ error: 'Este pedido no tiene un cobro en línea' }, 409);
  const total = Math.round(Number(p.total) + Number(p.cobro_recargo ?? 0));
  if (!(total > 0)) return responder({ error: 'El pedido no tiene valor' }, 400);
  if (p.wompi_link && p.wompi_link_vence && p.wompi_link_vence.getTime() > Date.now() + 10 * 60_000
      && Number(p.wompi_link_valor) === total && p.cobro_estado !== 'rechazado') {
    return responder({ url: `https://checkout.wompi.co/l/${p.wompi_link}`, total });
  }
  const origen = String(body.origen ?? '');
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(origen) && !/^http:\/\/localhost(:\d+)?$/.test(origen)) return responder({ error: 'Origen inválido' }, 400);
  const items = (await sql`select nombre, cantidad from public.pedido_items where pedido_id = ${p.id} order by id`) as unknown as { nombre: string; cantidad: number }[];
  const vence = new Date(Date.now() + 3 * 24 * 3600_000);
  const r = await fetch(`${API}/payment_links`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await secreto('wompi_private_key')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Pedido #${p.id}`,
      description: (items.map((i) => `${i.cantidad} × ${i.nombre}`).join(', ') + (Number(p.cobro_recargo) ? ' · incluye costo del pago en línea' : '')).slice(0, 250),
      single_use: true,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: total * 100,
      expires_at: vence.toISOString(),
      redirect_url: `${origen}/seguimiento/${seg}`,
      sku: seg,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.data?.id) {
    console.error('Wompi payment_links (pedido)', r.status, JSON.stringify(j));
    return responder({ error: 'No se pudo crear el link de pago. Intenta otra vez.' }, 502);
  }
  await sql`update public.pedidos set wompi_link = ${j.data.id}, wompi_link_vence = ${vence.toISOString()}::timestamptz, wompi_link_valor = ${total},
    cobro_estado = 'pendiente' where id = ${p.id} and pagado_linea is null`;
  return responder({ url: `https://checkout.wompi.co/l/${j.data.id}`, total });
}
