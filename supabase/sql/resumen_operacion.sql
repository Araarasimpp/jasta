-- Tablero de Inicio para alistamiento: solo datos de los pedidos (cantidades,
-- tiempos y productos por alistar). No trae plata ni la ganancia de la tienda.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
create or replace function public.resumen_operacion(p_dia date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  dia date := coalesce(p_dia, (now() at time zone 'America/Bogota')::date);
  d timestamptz := (dia::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((dia + 1)::text || ' 00:00 America/Bogota')::timestamptz;
begin
  if not (public.tiene_rol('admin') or public.tiene_rol('alistador') or public.tiene_rol('cuadres')) then
    raise exception 'Sin permiso';
  end if;
  return jsonb_build_object(
    'creados', (select count(*) from public.pedidos where canal <> 'local' and estado <> 'cancelado' and created_at >= d and created_at < h),
    'cancelados', (select count(*) from public.pedidos where canal <> 'local' and estado = 'cancelado' and created_at >= d and created_at < h),
    'alistados', (select count(*) from public.pedidos where canal <> 'local' and estado <> 'cancelado' and alistado_at >= d and alistado_at < h),
    'despachados', (select count(*) from public.pedidos where canal <> 'local' and estado in ('despachado', 'entregado') and asignado_at >= d and asignado_at < h),
    'entregados', (select count(*) from public.pedidos where canal <> 'local' and estado = 'entregado' and entregado_at >= d and entregado_at < h),
    'locales', (select count(*) from public.pedidos where canal = 'local' and estado = 'entregado' and created_at >= d and created_at < h),
    'por_estado', (select coalesce(jsonb_object_agg(estado, n), '{}') from (
        select estado, count(*) n from public.pedidos where canal <> 'local' and estado in ('por_alistar', 'alistado', 'despachado') group by estado) x),
    'sin_rotulo', (select count(*) from public.pedidos where canal <> 'local' and estado in ('por_alistar', 'alistado') and rotulo_impreso_at is null),
    -- Minutos desde que entra el pedido hasta que queda alistado (los alistados hoy)
    'min_alistar', (select round(extract(epoch from percentile_cont(0.5) within group (order by alistado_at - created_at)) / 60)
        from public.pedidos where canal <> 'local' and alistado_at >= d and alistado_at < h and alistado_at > created_at),
    'mas_antiguo', (select min(created_at) from public.pedidos where canal <> 'local' and estado = 'por_alistar'),
    -- Lo que hay que sacar de bodega para los pedidos por alistar
    'por_alistar', (select coalesce(jsonb_agg(x order by x.cantidad desc, x.nombre), '[]') from (
        select i.nombre, i.color, i.talla, sum(i.cantidad)::int cantidad, count(distinct i.pedido_id)::int pedidos
        from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
        where p.estado = 'por_alistar' and p.canal <> 'local'
        group by i.nombre, i.color, i.talla order by sum(i.cantidad) desc, i.nombre limit 20) x),
    'mensajeros', (select coalesce(jsonb_agg(x order by x.en_ruta desc, x.entregados desc), '[]') from (
        select u.nombre,
          count(*) filter (where p.estado = 'despachado')::int en_ruta,
          count(*) filter (where p.estado = 'entregado' and p.entregado_at >= d and p.entregado_at < h)::int entregados
        from public.pedidos p join public.usuarios u on u.id = p.mensajero_id
        where p.canal <> 'local' and (p.estado = 'despachado' or (p.estado = 'entregado' and p.entregado_at >= d and p.entregado_at < h))
        group by u.nombre) x),
    -- Últimos 7 días: pedidos que entraron y que se entregaron (cantidades, sin plata)
    'por_dia', (select jsonb_agg(jsonb_build_object('dia', g.dia,
          'creados', (select count(*) from public.pedidos p where p.canal <> 'local' and p.estado <> 'cancelado'
              and p.created_at >= (g.dia::text || ' 00:00 America/Bogota')::timestamptz and p.created_at < ((g.dia + 1)::text || ' 00:00 America/Bogota')::timestamptz),
          'entregados', (select count(*) from public.pedidos p where p.canal <> 'local' and p.estado = 'entregado'
              and p.entregado_at >= (g.dia::text || ' 00:00 America/Bogota')::timestamptz and p.entregado_at < ((g.dia + 1)::text || ' 00:00 America/Bogota')::timestamptz)
        ) order by g.dia) from (select generate_series(dia - 6, dia, interval '1 day')::date dia) g)
  );
end $$;
revoke execute on function public.resumen_operacion(date) from public, anon;
grant execute on function public.resumen_operacion(date) to authenticated;
