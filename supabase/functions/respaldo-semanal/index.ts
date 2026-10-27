// Edge Function respaldo-semanal: el Excel de la semana a los admins por Telegram.
//
// POST { hasta?: 'YYYY-MM-DD' } con el encabezado x-respaldo-secreto. Solo la llama
// la base de datos (privado.enviar_respaldo, con pg_net): los domingos en la noche
// (pg_cron) y cuando un admin lo pide desde Configuración (public.pedir_respaldo).
// Arma un .xlsx con una hoja por tema (los 7 días que terminan en "hasta") y lo manda
// al chat privado del bot de cada admin que tenga su cuenta vinculada.
import postgres from 'npm:postgres@3.4.5';
import * as XLSX from 'npm:xlsx@0.18.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });

function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), { status, headers: { 'content-type': 'application/json' } });
}

function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Columnas que parecen números pero son texto (no se suman)
const TEXTO = new Set(['Teléfono', 'SKU', 'Código']);

/** Filas con números de verdad (no texto) para que Excel pueda sumarlas */
function limpiar(filas: Record<string, unknown>[]): Record<string, unknown>[] {
  return filas.map((f) => {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) {
      if (typeof v === 'string' && !TEXTO.has(k) && /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v) && v.length < 16) o[k] = Number(v);
      else if (v instanceof Date) o[k] = v.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      else o[k] = v;
    }
    return o;
  });
}

function hoja(libro: XLSX.WorkBook, nombre: string, filas: Record<string, unknown>[]): void {
  const datos = limpiar(filas);
  const ws = datos.length ? XLSX.utils.json_to_sheet(datos) : XLSX.utils.aoa_to_sheet([['Sin movimientos en la semana']]);
  if (datos.length) {
    ws['!cols'] = Object.keys(datos[0]).map((k) => ({
      wch: Math.min(48, Math.max(k.length, ...datos.slice(0, 200).map((f) => String(f[k] ?? '').length)) + 2),
    }));
  }
  XLSX.utils.book_append_sheet(libro, ws, nombre);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const [cfg] = await sql`select secreto from privado.push_config where id`;
    if (!cfg?.secreto || !iguales(req.headers.get('x-respaldo-secreto') ?? '', cfg.secreto)) return json({ error: 'No autorizado' }, 401);
    const [tg] = await sql`select token from privado.telegram_config limit 1`;
    if (!tg?.token) return json({ error: 'El bot de Telegram no está conectado' }, 400);

    const cuerpo = await req.json().catch(() => ({}));
    const [r] = await sql`
      select coalesce(${cuerpo.hasta ?? null}::date, (now() at time zone 'America/Bogota')::date) as hasta`;
    const hasta: string = r.hasta.toISOString().slice(0, 10);
    const [rango] = await sql`
      select (${hasta}::date - 6) as desde,
             ((${hasta}::date - 6)::text || ' 00:00 America/Bogota')::timestamptz as d,
             ((${hasta}::date + 1)::text || ' 00:00 America/Bogota')::timestamptz as h`;
    const desde: string = rango.desde.toISOString().slice(0, 10);
    const { d, h } = rango;

    const libro = XLSX.utils.book_new();

    hoja(libro, 'Pedidos', await sql`
      select p.id as "Pedido", to_char(p.created_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as "Creado",
             p.estado::text as "Estado", p.canal as "Canal", v.nombre as "Vendedora", m.nombre as "Mensajero",
             p.cliente_nombre as "Cliente", p.cliente_telefono as "Teléfono", p.barrio as "Barrio", p.direccion as "Dirección",
             (select string_agg(i.cantidad || ' ' || i.nombre || coalesce(' (' || nullif(concat_ws(' ', i.color, i.talla), '') || ')', ''), ', ')
                from public.pedido_items i where i.pedido_id = p.id) as "Productos",
             p.total - p.valor_domicilio as "Subtotal", p.valor_domicilio as "Domicilio", p.total as "Total",
             p.tipo_recaudo as "Pago", p.valor_efectivo as "Efectivo", p.valor_transferencia as "Transferencia",
             to_char(p.entregado_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as "Entregado", p.cuadre_id as "Cuadre"
      from public.pedidos p
      left join public.usuarios v on v.id = p.vendedora_id
      left join public.usuarios m on m.id = p.mensajero_id
      where p.created_at >= ${d} and p.created_at < ${h}
      order by p.id`);

    hoja(libro, 'Vendido', await sql`
      select p.id as "Pedido", to_char(p.entregado_at at time zone 'America/Bogota', 'YYYY-MM-DD') as "Entregado",
             v.nombre as "Vendedora", i.nombre as "Producto", i.color as "Color", i.talla as "Talla", i.cantidad as "Cantidad",
             i.precio_venta as "Precio venta", i.precio_base as "Precio base", i.precio_compra as "Precio compra",
             i.precio_venta * i.cantidad as "Total", (i.precio_base - i.precio_compra) * i.cantidad as "Ganancia tienda",
             (i.precio_venta - i.precio_base) * i.cantidad as "Ganancia vendedora"
      from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
      left join public.usuarios v on v.id = p.vendedora_id
      where p.estado = 'entregado' and p.entregado_at >= ${d} and p.entregado_at < ${h}
      order by p.entregado_at, p.id`);

    hoja(libro, 'Cuadres', await sql`
      select c.id as "Cuadre", c.codigo as "Código", m.nombre as "Mensajero", c.fecha_entrega::text as "Día de entrega",
             c.cantidad_pedidos as "Pedidos", c.total_efectivo as "Efectivo", c.total_transferencia as "Transferencia",
             c.total_domicilios as "Domicilios", c.estado as "Estado", c.cerrado_por_nombre as "Cerró",
             to_char(c.cerrado_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as "Cerrado",
             c.confirmado_por_nombre as "Recibió", to_char(c.confirmado_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as "Recibido"
      from public.cuadres c left join public.usuarios m on m.id = c.mensajero_id
      where c.cerrado_at >= ${d} and c.cerrado_at < ${h}
      order by c.cerrado_at`);

    hoja(libro, 'Gastos', await sql`
      select g.fecha::text as "Fecha", g.categoria as "Categoría", g.descripcion as "Descripción", g.valor as "Valor",
             g.metodo as "Método", g.creado_por_nombre as "Registró"
      from public.gastos g where g.fecha between ${desde}::date and ${hasta}::date
      order by g.fecha, g.id`);

    hoja(libro, 'Comisiones pagadas', await sql`
      select l.id as "Pago", v.nombre as "Vendedora", l.desde::text as "Desde", l.hasta::text as "Hasta",
             l.cantidad_pedidos as "Pedidos", l.total as "Total", l.metodo as "Método", l.pagado_por_nombre as "Pagó",
             to_char(l.pagado_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as "Fecha", case when l.anulada then 'Sí' else 'No' end as "Anulado"
      from public.liquidaciones l left join public.usuarios v on v.id = l.vendedora_id
      where l.pagado_at >= ${d} and l.pagado_at < ${h}
      order by l.pagado_at`);

    hoja(libro, 'Devoluciones', await sql`
      select dv.pedido_id as "Pedido", to_char(dv.created_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as "Fecha",
             dv.tipo as "Tipo", dv.motivo as "Motivo", di.nombre as "Producto", di.cantidad as "Cantidad",
             case when dv.estado_producto = 'danado' then 'Dañado' else 'Volvió al inventario' end as "Estado",
             dv.reembolso as "Reembolso", dv.comision_descuento as "Comisión descontada", dv.creado_por_nombre as "Registró", dv.nota as "Nota"
      from public.devoluciones dv join public.devolucion_items di on di.devolucion_id = dv.id
      where dv.created_at >= ${d} and dv.created_at < ${h}
      order by dv.created_at`);

    hoja(libro, 'Movimientos inventario', await sql`
      select to_char(mv.created_at at time zone 'America/Bogota', 'YYYY-MM-DD HH24:MI') as "Fecha", pr.nombre as "Producto",
             mv.tipo as "Tipo", mv.cantidad as "Cantidad", mv.stock_antes as "Antes", mv.stock_despues as "Después",
             mv.motivo as "Motivo", mv.autor as "Quién"
      from public.inventario_movimientos mv left join public.productos pr on pr.id = mv.producto_id
      where mv.created_at >= ${d} and mv.created_at < ${h}
      order by mv.created_at`);

    hoja(libro, 'Inventario hoy', await sql`
      select pr.nombre as "Producto", pr.sku as "SKU", case when pr.controla_stock then pr.stock end as "Stock",
             case when pr.controla_stock then pr.stock_minimo end as "Mínimo", pr.precio_venta as "Precio venta",
             pr.precio_base as "Precio base", pr.precio_compra as "Precio compra",
             case when pr.controla_stock then greatest(pr.stock, 0) * pr.precio_compra end as "Valor a costo"
      from public.productos pr where pr.activo
      order by pr.nombre`);

    const archivo = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const nombre = `Respaldo Jasta ${desde} a ${hasta}.xlsx`;

    const admins = await sql`
      select distinct t.telegram_id from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id
      where u.activo and 'admin' = any (u.roles::text[])`;
    let enviados = 0;
    for (const a of admins) {
      const form = new FormData();
      form.append('chat_id', String(a.telegram_id));
      form.append('caption', `📦 Respaldo de la semana: ${desde} a ${hasta}\nPedidos, vendido, cuadres, gastos, comisiones, devoluciones e inventario.`);
      form.append('document', new Blob([archivo], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombre);
      const res = await fetch(`https://api.telegram.org/bot${tg.token}/sendDocument`, { method: 'POST', body: form });
      if (res.ok) enviados++;
    }
    return json({ enviados, desde, hasta });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
