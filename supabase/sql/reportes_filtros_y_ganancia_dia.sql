-- Reportes con filtros de vendedora y estado del pedido, y ganancia de la
-- tienda por día para la gráfica de Inicio.
-- Las funciones reporte(desde, hasta) y reporte_totales(desde, hasta) siguen
-- existiendo y ahora llaman a las nuevas con los valores de antes (solo
-- entregados, todas las vendedoras).
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

-- p_estado: 'entregado' | 'por_alistar' | 'alistado' | 'despachado' | 'cancelado' | 'todos'
-- p_vendedora: id de la vendedora, o null para todas (las vendedoras solo ven lo suyo)

create or replace function public.reporte_filtrado(p_desde date, p_hasta date, p_estado text default 'entregado', p_vendedora bigint default null)
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
  v_vend bigint := case when v_todo then p_vendedora else v_yo end;
  v_est text := coalesce(nullif(p_estado, ''), 'entregado');
  r jsonb;
begin
  if not v_todo and not public.tiene_rol('vendedora') then raise exception 'Sin permiso'; end if;
  with ent as (
    select * from public.pedidos
    where (v_est = 'todos' or estado::text = v_est) and created_at >= d and created_at < h
      and (v_vend is null or vendedora_id = v_vend)
  ), it as (
    select i.*, ent.vendedora_id from public.pedido_items i join ent on ent.id = i.pedido_id
  ), gi as (
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
  if not v_todo then
    r := jsonb_set(r, '{productos}', coalesce((select jsonb_agg(x - 'ganancia_tienda' - 'costo' - 'ganancia') from jsonb_array_elements(r->'productos') x), '[]'));
    r := jsonb_set(r, '{barrios}', coalesce((select jsonb_agg(x - 'ganancia_tienda') from jsonb_array_elements(r->'barrios') x), '[]'));
    r := jsonb_set(r, '{dias}', coalesce((select jsonb_agg(x - 'ganancia_tienda') from jsonb_array_elements(r->'dias') x), '[]'));
  end if;
  return r;
end $function$;

create or replace function public.reporte_totales_filtrado(p_desde date, p_hasta date, p_estado text default 'entregado', p_vendedora bigint default null)
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
  v_vend bigint := case when v_todo then p_vendedora else v_yo end;
  v_est text := coalesce(nullif(p_estado, ''), 'entregado');
  r jsonb;
begin
  if not v_todo and not public.tiene_rol('vendedora') then raise exception 'Sin permiso'; end if;
  with ent as (select * from public.pedidos where (v_est = 'todos' or estado::text = v_est) and created_at >= d and created_at < h
                 and (v_vend is null or vendedora_id = v_vend)),
  it as (select i.* from public.pedido_items i join ent on ent.id = i.pedido_id)
  select jsonb_build_object(
    'pedidos', (select count(*) from ent),
    'unidades', (select coalesce(sum(cantidad),0) from it),
    'ventas', (select coalesce(sum(total),0) from it),
    'domicilios', (select coalesce(sum(valor_domicilio),0) from ent),
    'cobrado', (select coalesce(sum(total),0) from ent),
    'costo', (select coalesce(sum(precio_compra * cantidad),0) from it),
    'ganancia_tienda', (select coalesce(sum((precio_base - precio_compra) * cantidad),0) from it),
    'ganancia_vendedoras', (select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it),
    'efectivo', (select coalesce(sum(valor_efectivo),0) from ent),
    'transferencia', (select coalesce(sum(valor_transferencia),0) from ent),
    'cancelados', (select count(*) from public.pedidos where estado = 'cancelado' and created_at >= d and created_at < h
                     and (v_vend is null or vendedora_id = v_vend))
  ) into r;
  if not v_todo then r := r - 'ganancia_tienda' - 'costo'; end if;
  return r;
end $function$;

create or replace function public.reporte(p_desde date, p_hasta date)
 returns jsonb language sql stable security definer set search_path to ''
as $function$ select public.reporte_filtrado(p_desde, p_hasta, 'entregado', null) $function$;

create or replace function public.reporte_totales(p_desde date, p_hasta date)
 returns jsonb language sql stable security definer set search_path to ''
as $function$ select public.reporte_totales_filtrado(p_desde, p_hasta, 'entregado', null) $function$;

-- Ganancia de la tienda por día (pedidos entregados, por fecha de creación,
-- igual que en Reportes): (precio base − precio de compra) × cantidad
create or replace function public.ganancia_por_dia(p_desde date, p_hasta date)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
begin
  if not (public.tiene_rol('admin') or public.tiene_rol('cuadres')) then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('dia', dia, 'ganancia', g, 'pedidos', n) order by dia), '[]') from (
    select (p.created_at at time zone 'America/Bogota')::date dia,
      count(distinct p.id) n,
      coalesce(sum((i.precio_base - i.precio_compra) * i.cantidad), 0) g
    from public.pedidos p left join public.pedido_items i on i.pedido_id = p.id
    where p.estado = 'entregado' and p.created_at >= d and p.created_at < h
    group by 1) s);
end $function$;

revoke execute on function public.reporte_filtrado(date, date, text, bigint) from public, anon;
revoke execute on function public.reporte_totales_filtrado(date, date, text, bigint) from public, anon;
revoke execute on function public.ganancia_por_dia(date, date) from public, anon;
grant execute on function public.reporte_filtrado(date, date, text, bigint) to authenticated;
grant execute on function public.reporte_totales_filtrado(date, date, text, bigint) to authenticated;
grant execute on function public.ganancia_por_dia(date, date) to authenticated;
