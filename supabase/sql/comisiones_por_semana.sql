-- Comisiones por periodo (sábado a viernes) (YA APLICADO)
-- La página de Comisiones filtra por Desde/Hasta (por defecto la última semana de sábado a viernes)
-- y el pago cubre exactamente ese rango.

-- Lo que se le debe a cada vendedora en un rango de días de entrega (sin pagar), y cuánto le
-- queda pendiente de antes de ese rango
create or replace function public.comisiones_periodo(p_desde date, p_hasta date)
returns table(vendedora_id bigint, nombre text, pedidos bigint, total numeric, desde date, hasta date, anteriores numeric)
language plpgsql stable security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id(); v_v bigint;
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  v_v := case when public.tiene_rol('admin') then null else v_yo end;
  return query
    with x as (
      select l.vendedora_id, l.dia, l.comision, true es_pedido from privado.por_liquidar(v_v) l
      union all
      select dl.vendedora_id, dl.dia, dl.comision, false from privado.descuentos_por_liquidar(v_v) dl
    )
    select x.vendedora_id, u.nombre,
      count(*) filter (where x.es_pedido and x.dia between p_desde and p_hasta),
      coalesce(sum(x.comision) filter (where x.dia between p_desde and p_hasta), 0),
      min(x.dia) filter (where x.dia between p_desde and p_hasta),
      max(x.dia) filter (where x.dia between p_desde and p_hasta),
      coalesce(sum(x.comision) filter (where x.dia < p_desde), 0)
    from x join public.usuarios u on u.id = x.vendedora_id
    group by 1, 2
    having coalesce(sum(x.comision) filter (where x.dia between p_desde and p_hasta), 0) <> 0
        or coalesce(sum(x.comision) filter (where x.dia < p_desde), 0) <> 0
    order by 4 desc;
end $function$;
revoke execute on function public.comisiones_periodo(date, date) from public, anon;
grant execute on function public.comisiones_periodo(date, date) to authenticated;

-- El pago puede cubrir un rango (desde–hasta); sin desde, todo lo pendiente hasta ese día (como antes)
drop function if exists public.pagar_liquidacion(bigint, date, text, text[], text);
create or replace function public.pagar_liquidacion(p_vendedora bigint, p_hasta date, p_metodo text, p_comprobantes text[], p_nota text, p_desde date default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_ev text[]; v_n int; v_total numeric; v_desc numeric; v_desde date; v_hasta date; v_ini date := coalesce(p_desde, '2000-01-01');
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin registra pagos a vendedoras'; end if;
  if p_metodo not in ('efectivo', 'transferencia', 'otro') then raise exception 'Forma de pago inválida'; end if;
  if p_hasta < v_ini then raise exception 'La fecha hasta debe ser después de la fecha desde'; end if;
  v_ev := privado.comprobantes_validos(p_comprobantes);
  select count(*), coalesce(sum(comision), 0), min(dia), max(dia) into v_n, v_total, v_desde, v_hasta
    from privado.por_liquidar(p_vendedora) where dia between v_ini and p_hasta;
  select coalesce(sum(comision), 0) into v_desc from privado.descuentos_por_liquidar(p_vendedora) where dia between v_ini and p_hasta;
  if v_n = 0 and v_desc = 0 then raise exception 'No hay comisiones pendientes en esas fechas'; end if;
  insert into public.liquidaciones (vendedora_id, desde, hasta, cantidad_pedidos, total, metodo, comprobantes, nota, pagado_por, pagado_por_nombre)
  values (p_vendedora, coalesce(p_desde, v_desde), coalesce(p_hasta, v_hasta), v_n, v_total + v_desc, p_metodo, v_ev, nullif(trim(coalesce(p_nota, '')), ''), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  update public.pedidos set liquidacion_id = v_id where id in (select id from privado.por_liquidar(p_vendedora) where dia between v_ini and p_hasta);
  update public.devoluciones set liquidacion_id = v_id where id in (select devolucion_id from privado.descuentos_por_liquidar(p_vendedora) where dia between v_ini and p_hasta);
  perform privado.avisar(array[p_vendedora], 'liquidacion', 'Te pagaron tus comisiones',
    privado.pesos(v_total + v_desc) || ' · ' || v_n || ' pedidos · ' || p_metodo, '/app/comisiones', null);
  return v_id;
end $function$;
revoke execute on function public.pagar_liquidacion(bigint, date, text, text[], text, date) from public, anon;
grant execute on function public.pagar_liquidacion(bigint, date, text, text[], text, date) to authenticated;
