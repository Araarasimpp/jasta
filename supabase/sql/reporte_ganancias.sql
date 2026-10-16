-- Reportes: ganancia vendedora y ganancia tienda también por producto, por
-- barrio y por día (antes solo estaban en Detalle, Pedidos y Por vendedora).
--   Ganancia tienda    = (precio base − precio de compra) × cantidad
--   Ganancia vendedora = (precio de venta − precio base) × cantidad
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

create or replace function public.reporte(p_desde date, p_hasta date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_todo boolean := public.tiene_rol('admin') or public.tiene_rol('cuadres');
  v_yo bigint := public.mi_usuario_id();
  r jsonb;
begin
  if not v_todo and not public.tiene_rol('vendedora') then raise exception 'Sin permiso'; end if;
  with ent as (
    select * from public.pedidos
    where estado = 'entregado' and created_at >= d and created_at < h and (v_todo or vendedora_id = v_yo)
  ), it as (
    select i.*, ent.vendedora_id from public.pedido_items i join ent on ent.id = i.pedido_id
  ), gi as (
    -- Ganancias de cada pedido, para sumarlas por barrio y por día
    select pedido_id, sum(precio_base * cantidad) base, sum(precio_compra * cantidad) compra, sum(total) ventas
    from it group by pedido_id
  )
  select jsonb_build_object(
    'vendedoras', (select coalesce(jsonb_agg(x order by (x->>'ventas')::numeric desc), '[]') from (
      select jsonb_build_object('id', u.id, 'nombre', coalesce(u.nombre, 'Sin vendedora'),
        'pedidos', (select count(*) from ent e where e.vendedora_id is not distinct from s.vendedora_id),
        'unidades', s.unidades, 'ventas', s.ventas, 'base', s.base,
        'ganancia_vendedora', s.ventas - s.base, 'ganancia_tienda', s.base - s.compra) x
      from (select vendedora_id, sum(cantidad) unidades, sum(total) ventas, sum(precio_base * cantidad) base, sum(precio_compra * cantidad) compra
            from it group by vendedora_id) s
      left join public.usuarios u on u.id = s.vendedora_id) q),
    'mensajeros', (select coalesce(jsonb_agg(jsonb_build_object('nombre', coalesce(u.nombre, 'Sin mensajero'), 'entregas', s.n, 'pedidos', s.n,
        'domicilios', s.dom, 'efectivo', s.ef, 'transferencia', s.tr, 'total', s.tot) order by s.n desc), '[]') from (
      select mensajero_id, count(*) n, sum(valor_domicilio) dom, coalesce(sum(valor_efectivo),0) ef, coalesce(sum(valor_transferencia),0) tr, sum(total) tot
      from ent group by mensajero_id) s left join public.usuarios u on u.id = s.mensajero_id),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object('nombre', nombre, 'unidades', u, 'ventas', v, 'costo', c, 'ganancia', v - c,
        'ganancia_vendedora', v - b, 'ganancia_tienda', b - c) order by u desc), '[]') from (
      select nombre, sum(cantidad) u, sum(total) v, sum(precio_compra * cantidad) c, sum(precio_base * cantidad) b from it group by nombre) s),
    'barrios', (select coalesce(jsonb_agg(jsonb_build_object('barrio', b, 'pedidos', n, 'ventas', v, 'domicilios', dom,
        'ganancia_vendedora', gv, 'ganancia_tienda', gt) order by n desc), '[]') from (
      select initcap(lower(trim(e.barrio))) b, count(*) n, sum(e.total - e.valor_domicilio) v, sum(e.valor_domicilio) dom,
        coalesce(sum(g.ventas - g.base), 0) gv, coalesce(sum(g.base - g.compra), 0) gt
      from ent e left join gi g on g.pedido_id = e.id
      where e.barrio is not null and trim(e.barrio) <> '' group by 1) s),
    'dias', (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'pedidos', n, 'ventas', v, 'domicilios', dom, 'efectivo', ef, 'transferencia', tr,
        'ganancia_vendedora', gv, 'ganancia_tienda', gt) order by dia), '[]') from (
      select (e.created_at at time zone 'America/Bogota')::date dia, count(*) n, sum(e.total - e.valor_domicilio) v, sum(e.valor_domicilio) dom,
        coalesce(sum(e.valor_efectivo),0) ef, coalesce(sum(e.valor_transferencia),0) tr,
        coalesce(sum(g.ventas - g.base), 0) gv, coalesce(sum(g.base - g.compra), 0) gt
      from ent e left join gi g on g.pedido_id = e.id group by 1) s)
  ) into r;
  -- La ganancia de la tienda solo la ven admin y cuadres
  if not v_todo then
    r := jsonb_set(r, '{productos}', coalesce((select jsonb_agg(x - 'ganancia_tienda' - 'costo' - 'ganancia') from jsonb_array_elements(r->'productos') x), '[]'));
    r := jsonb_set(r, '{barrios}', coalesce((select jsonb_agg(x - 'ganancia_tienda') from jsonb_array_elements(r->'barrios') x), '[]'));
    r := jsonb_set(r, '{dias}', coalesce((select jsonb_agg(x - 'ganancia_tienda') from jsonb_array_elements(r->'dias') x), '[]'));
  end if;
  return r;
end $function$;
