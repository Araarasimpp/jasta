-- Reportes: fila "Total" de las pestañas Productos vendidos y Pedidos.
-- Suman TODAS las filas que cumplen los filtros (fechas, estado, vendedora y
-- búsqueda), no solo la página que se ve. SECURITY INVOKER sobre las vistas
-- (que también son security_invoker): cada quien suma solo lo que puede ver.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

create or replace function public.sumas_ventas_detalle(p_desde timestamptz, p_hasta timestamptz, p_estado text default 'entregado', p_vendedora bigint default null, p_texto text default '')
 returns jsonb language sql stable security invoker set search_path to ''
as $fn$
  with f as (
    select * from public.ventas_detalle v
    where v.created_at >= p_desde and v.created_at <= p_hasta
      and (coalesce(p_estado, 'todos') = 'todos' or v.estado::text = p_estado)
      and (p_vendedora is null or v.vendedora_id = p_vendedora)
      and (coalesce(trim(p_texto), '') = ''
        or (trim(p_texto) ~ '^\d+$' and v.pedido_id = trim(p_texto)::bigint)
        or (trim(p_texto) !~ '^\d+$' and (v.producto ilike '%' || trim(p_texto) || '%' or v.cliente_nombre ilike '%' || trim(p_texto) || '%' or v.sku ilike '%' || trim(p_texto) || '%')))
  )
  select jsonb_build_object(
    'filas', count(*), 'cantidad', coalesce(sum(cantidad), 0), 'total', coalesce(sum(total), 0),
    'ganancia_tienda', coalesce(sum(ganancia_tienda), 0), 'ganancia_vendedora', coalesce(sum(ganancia_vendedora), 0),
    -- El domicilio se repite en cada línea del pedido: se cuenta una vez por pedido
    'domicilio', coalesce((select sum(d) from (select distinct on (pedido_id) domicilio_pedido d from f) x), 0))
  from f
$fn$;

create or replace function public.sumas_ventas_pedidos(p_desde timestamptz, p_hasta timestamptz, p_estado text default 'entregado', p_vendedora bigint default null, p_texto text default '')
 returns jsonb language sql stable security invoker set search_path to ''
as $fn$
  select jsonb_build_object(
    'filas', count(*), 'unidades', coalesce(sum(unidades), 0), 'subtotal', coalesce(sum(subtotal), 0), 'domicilio', coalesce(sum(domicilio), 0),
    'total', coalesce(sum(total), 0), 'costo', coalesce(sum(costo), 0), 'ganancia_tienda', coalesce(sum(ganancia_tienda), 0),
    'ganancia_vendedora', coalesce(sum(ganancia_vendedora), 0), 'efectivo', coalesce(sum(valor_efectivo), 0), 'transferencia', coalesce(sum(valor_transferencia), 0))
  from public.ventas_pedidos v
  where v.created_at >= p_desde and v.created_at <= p_hasta
    and (coalesce(p_estado, 'todos') = 'todos' or v.estado::text = p_estado)
    and (p_vendedora is null or v.vendedora_id = p_vendedora)
    and (coalesce(trim(p_texto), '') = ''
      or (trim(p_texto) ~ '^\d+$' and v.id = trim(p_texto)::bigint)
      or (trim(p_texto) !~ '^\d+$' and (v.cliente_nombre ilike '%' || trim(p_texto) || '%' or v.barrio ilike '%' || trim(p_texto) || '%' or v.productos ilike '%' || trim(p_texto) || '%')))
$fn$;

revoke execute on function public.sumas_ventas_detalle(timestamptz, timestamptz, text, bigint, text) from public, anon;
revoke execute on function public.sumas_ventas_pedidos(timestamptz, timestamptz, text, bigint, text) from public, anon;
grant execute on function public.sumas_ventas_detalle(timestamptz, timestamptz, text, bigint, text) to authenticated;
grant execute on function public.sumas_ventas_pedidos(timestamptz, timestamptz, text, bigint, text) to authenticated;
