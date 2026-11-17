-- YA APLICADO (2026-11-17). Queda aquí como registro.

-- 15. Resumen de la semana para cada vendedora: el domingo a las 7 p. m. le llega un aviso con
-- lo que vendió en los últimos 7 días (lunes a domingo), lo que ganó, su puesto y su producto estrella.
create or replace function privado.resumen_semanal_vendedoras()
 returns int language plpgsql security definer set search_path to ''
as $function$
declare
  v_hasta date := (now() at time zone 'America/Bogota')::date;
  v_desde date := v_hasta - 6;
  d timestamptz := (v_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((v_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  r record; v_n int := 0; v_top text;
begin
  for r in
    with s as (
      select p.vendedora_id, count(*) pedidos, sum(p.total - coalesce(p.valor_domicilio, 0)) ventas, sum(privado.comision(p.id)) ganancia
      from public.pedidos p
      where p.estado = 'entregado' and p.vendedora_id is not null and p.created_at >= d and p.created_at < h
      group by 1
    )
    select s.*, rank() over (order by s.ventas desc) puesto, count(*) over () total
    from s join public.usuarios u on u.id = s.vendedora_id and u.activo and 'vendedora' = any(u.roles::text[])
  loop
    select i.nombre into v_top from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
     where p.vendedora_id = r.vendedora_id and p.estado = 'entregado' and p.created_at >= d and p.created_at < h
     group by i.nombre order by sum(i.cantidad) desc limit 1;
    perform privado.avisar(array[r.vendedora_id], 'resumen', 'Tu semana: ganaste ' || privado.pesos(r.ganancia),
      r.pedidos || case when r.pedidos = 1 then ' pedido entregado' else ' pedidos entregados' end
        || ' · vendiste ' || privado.pesos(r.ventas)
        || ' · puesto ' || r.puesto || ' de ' || r.total
        || coalesce(' · lo que más vendiste: ' || v_top, ''),
      '/app/mi-panel', null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;

-- Domingos 7:00 p. m. de Colombia (00:00 UTC del lunes)
do $$ begin
  if not exists (select 1 from cron.job where jobname = 'resumen-semanal-vendedoras') then
    perform cron.schedule('resumen-semanal-vendedoras', '0 0 * * 1', 'select privado.resumen_semanal_vendedoras()');
  end if;
end $$;

-- 12. Mes contra mes: el mes elegido contra el mes pasado y el mismo mes del año pasado.
-- Si el mes va en curso, se compara con los mismos días (del 1 al día de hoy) de los otros meses.
create or replace function privado.cifras_periodo(p_desde date, p_hasta date)
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  select jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'pedidos', (select count(*) from public.ventas_pedidos v where v.estado = 'entregado'
        and v.created_at >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz and v.created_at < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz),
    'ventas', (select coalesce(sum(v.subtotal), 0) from public.ventas_pedidos v where v.estado = 'entregado'
        and v.created_at >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz and v.created_at < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz),
    'ganancia', (select coalesce(sum(v.ganancia_tienda), 0) from public.ventas_pedidos v where v.estado = 'entregado'
        and v.created_at >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz and v.created_at < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz),
    'comisiones', (select coalesce(sum(v.ganancia_vendedora), 0) from public.ventas_pedidos v where v.estado = 'entregado'
        and v.created_at >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz and v.created_at < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz),
    'gastos', (select coalesce(sum(g.valor), 0) from public.gastos g where g.fecha between p_desde and p_hasta and g.categoria <> 'caja_local')
  )
$function$;

create or replace function public.comparar_meses(p_mes date)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_ini date := date_trunc('month', p_mes)::date;
  v_fin date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  v_dias int;
  v_ant date := (v_ini - interval '1 month')::date;
  v_anio date := (v_ini - interval '1 year')::date;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if v_ini > v_hoy then raise exception 'Ese mes todavía no ha llegado'; end if;
  v_dias := (least(v_fin, v_hoy) - v_ini);
  return jsonb_build_object(
    'en_curso', v_fin > v_hoy,
    'actual', privado.cifras_periodo(v_ini, v_ini + v_dias),
    'anterior', privado.cifras_periodo(v_ant, least((v_ant + v_dias), (v_ini - 1))),
    'anio', privado.cifras_periodo(v_anio, least((v_anio + v_dias), (v_anio + interval '1 month - 1 day')::date)));
end $function$;
grant execute on function public.comparar_meses(date) to authenticated;
