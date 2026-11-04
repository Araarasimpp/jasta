// Edge Function wompi-eventos: Wompi avisa aquí cada cambio de una transacción (URL de eventos
// configurada en el panel de Wompi → Desarrolladores). Se verifica la firma con el secreto de
// eventos (en Vault) y, si la transacción es de un link de pago de la tienda, se registra el pago.
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function valor(obj: unknown, ruta: string): unknown {
  return ruta.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok');
  try {
    const ev = await req.json();
    const [s] = await sql`select public.wompi_secreto('wompi_events_secret') as v`;
    const props: string[] = ev?.signature?.properties ?? [];
    if (!s?.v || !props.length || ev.timestamp == null) return new Response('firma incompleta', { status: 400 });
    const cadena = props.map((p) => String(valor(ev.data, p) ?? '')).join('') + String(ev.timestamp) + s.v;
    const esperado = await sha256(cadena);
    const recibido = String(ev.signature.checksum ?? req.headers.get('x-event-checksum') ?? '').toLowerCase();
    if (esperado !== recibido) {
      console.warn('Firma de Wompi inválida');
      return new Response('firma inválida', { status: 401 });
    }
    if (ev.event === 'transaction.updated') {
      const t = ev.data?.transaction;
      if (t?.payment_link_id) {
        const [r] = await sql`select public.wompi_registrar(${t.payment_link_id}, ${t.id}, ${t.status}, ${t.amount_in_cents}, ${t.payment_method_type ?? null}) as r`;
        console.log('Wompi', t.id, t.status, JSON.stringify(r?.r));
      }
    }
    return new Response('ok');
  } catch (e) {
    console.error(e);
    return new Response('error', { status: 500 });
  }
});
