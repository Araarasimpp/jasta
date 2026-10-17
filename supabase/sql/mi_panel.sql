-- Panel de la vendedora ("Mi panel"): sus ganancias en un rango de fechas y
-- sus conversaciones con los mensajeros. Siempre sobre la vendedora que llama.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

create or replace function public.mi_panel(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_yo bigint := public.mi_usuario_id();
  r jsonb;
begin
  if v_yo is null or not (public.tiene_rol('vendedora') or public.tiene_rol('admin')) then raise exception 'Sin permiso'; end if;
  if p_hasta < p_desde or p_hasta - p_desde > 400 then raise exception 'Rango de fechas inválido (máximo 400 días)'; end if;
  with mios as (
    select * from public.pedidos where vendedora_id = v_yo and created_at >= d and created_at < h
  ), it as (
    select i.*, m.estado, m.created_at as pedido_at from public.pedido_items i join mios m on m.id = i.pedido_id
  ), dias as (
    select g::date as dia from generate_series(p_desde, p_hasta, interval '1 day') g
  )
  select jsonb_build_object(
    'ganancia', (select coalesce(sum((precio_venta - precio_base) * cantidad), 0) from it where estado = 'entregado'),
    'ventas', (select coalesce(sum(total), 0) from it where estado = 'entregado'),
    'entregados', (select count(*) from mios where estado = 'entregado'),
    'unidades', (select coalesce(sum(cantidad), 0) from it where estado = 'entregado'),
    'en_curso', (select count(*) from mios where estado in ('por_alistar', 'alistado', 'despachado')),
    'ganancia_en_curso', (select coalesce(sum((precio_venta - precio_base) * cantidad), 0) from it where estado in ('por_alistar', 'alistado', 'despachado')),
    'cancelados', (select count(*) from mios where estado = 'cancelado'),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', dias.dia, 'ganancia', coalesce(x.g, 0)) order by dias.dia), '[]')
                from dias left join (
                  select (pedido_at at time zone 'America/Bogota')::date as dia, sum((precio_venta - precio_base) * cantidad) as g
                  from it where estado = 'entregado' group by 1) x on x.dia = dias.dia)
  ) into r;
  return r;
end $fn$;

-- Conversaciones de la vendedora: sus pedidos que tienen mensajes (los más recientes primero)
-- y los que están en ruta (para escribirle al mensajero aunque aún no haya mensajes).
create or replace function public.mis_conversaciones()
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null or not (public.tiene_rol('vendedora') or public.tiene_rol('admin')) then raise exception 'Sin permiso'; end if;
  return coalesce((
    select jsonb_agg(c order by c.orden desc) from (
      select p.id as pedido_id, p.cliente_nombre, p.estado, p.total, u.nombre as mensajero, u.avatar_url as mensajero_foto,
             um.texto as ultimo_texto, um.autor_nombre as ultimo_autor, (um.autor_id = v_yo) as ultimo_mio, um.created_at as ultimo_at,
             coalesce(um.created_at, p.asignado_at, p.created_at) as orden
      from public.pedidos p
      left join public.usuarios u on u.id = p.mensajero_id
      left join lateral (select * from public.pedido_mensajes m where m.pedido_id = p.id order by m.created_at desc limit 1) um on true
      where p.vendedora_id = v_yo
        and (um.id is not null or p.estado = 'despachado')
        and coalesce(um.created_at, p.created_at) > now() - interval '45 days'
      order by coalesce(um.created_at, p.asignado_at, p.created_at) desc
      limit 30
    ) c), '[]');
end $fn$;

revoke all on function public.mi_panel(date, date) from public, anon;
revoke all on function public.mis_conversaciones() from public, anon;
grant execute on function public.mi_panel(date, date) to authenticated;
grant execute on function public.mis_conversaciones() to authenticated;
