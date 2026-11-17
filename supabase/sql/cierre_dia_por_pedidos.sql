-- YA APLICADO (2026-11-17). Queda aquí como registro.
-- Mi cierre del día, por el día de los pedidos:
--  * Los cuadres que salen son los de las entregas de ese día (fecha_entrega), no el día en que se confirmaron.
--  * Comisiones, ganancia (para el ahorro) y mercancía se sacan de TODOS los pedidos entregados de ese día
--    (día del pedido = created_at en Colombia, el mismo que usan las comisiones). Solo el primer cierre
--    del día las separa; si otro admin cierra ese día también, solo registra la plata que recibió.
--  * Si queda un pedido de ese día sin entregar, no deja cerrar: se gestiona o se pasa al día siguiente.

create or replace function privado.pedidos_del_dia(p_fecha date)
 returns table(id bigint, estado text, canal text, vendedora_id bigint, mensajero_id bigint, cliente_nombre text, barrio text, total numeric,
   comision numeric, ganancia numeric, costo numeric)
 language sql stable security definer set search_path to ''
as $function$
  select p.id, p.estado::text, p.canal, p.vendedora_id, p.mensajero_id, p.cliente_nombre, p.barrio, p.total,
    case when p.vendedora_id is not null and p.estado = 'entregado' then privado.comision(p.id) else 0 end,
    coalesce(v.ganancia_tienda, 0), coalesce(v.costo, 0)
  from public.pedidos p left join public.ventas_pedidos v on v.id = p.id
  where p.estado <> 'cancelado'
    and p.created_at >= (p_fecha::text || ' 00:00 America/Bogota')::timestamptz
    and p.created_at < ((p_fecha + 1)::text || ' 00:00 America/Bogota')::timestamptz
$function$;

create or replace function public.cierre_dia_datos(p_fecha date)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  v_otro text;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  select k.admin_nombre into v_otro from public.cierres_dia k
   where k.fecha = p_fecha and not k.anulado and k.admin_id <> v_yo and (k.comisiones <> 0 or k.ahorro <> 0 or k.mercancia <> 0) limit 1;
  return jsonb_build_object(
    'cuadres', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'mensajero', u.nombre, 'pedidos', c.cantidad_pedidos, 'fecha_entrega', c.fecha_entrega, 'estado', c.estado,
        'efectivo', c.total_efectivo - c.total_domicilios - coalesce(c.total_propinas, 0), 'transferencia', c.total_transferencia,
        'recibio', c.confirmado_por_nombre, 'recibio_id', c.confirmado_por, 'hora', coalesce(c.confirmado_at, c.cerrado_at),
        'comisiones', 0, 'ganancia', 0, 'costo', 0,
        'en_cierre', (select k.admin_nombre from public.cierres_dia k where not k.anulado and c.id = any(k.cuadres) limit 1)
      ) order by c.cerrado_at), '[]')
      from public.cuadres c left join public.usuarios u on u.id = c.mensajero_id
      where c.estado in ('confirmado', 'pendiente') and c.fecha_entrega = p_fecha),
    'cajas', (select coalesce(jsonb_agg(jsonb_build_object(
        'fecha', k.fecha, 'efectivo', coalesce(k.recibido, k.recoger, 0), 'recibio', coalesce(k.recibido_por, k.entregado_por), 'hora', coalesce(k.recibido_at, k.entregado_at, k.updated_at),
        'recibida', k.recibido_at is not null, 'comisiones', 0, 'ganancia', 0, 'costo', 0,
        'en_cierre', (select z.admin_nombre from public.cierres_dia z where not z.anulado and k.fecha = any(z.cajas) limit 1)
      )), '[]')
      from public.cierres_caja k where k.fecha = p_fecha),
    -- Todo lo del día (para comisiones, ahorro y mercancía)
    'dia', (select jsonb_build_object('pedidos', count(*) filter (where x.estado = 'entregado'),
        'ventas', coalesce(sum(x.total) filter (where x.estado = 'entregado'), 0),
        'ganancia', coalesce(sum(x.ganancia) filter (where x.estado = 'entregado'), 0),
        'comisiones', coalesce(sum(x.comision), 0),
        'costo', coalesce(sum(x.costo) filter (where x.estado = 'entregado'), 0))
      from privado.pedidos_del_dia(p_fecha) x),
    'pendientes', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'estado', x.estado, 'cliente', x.cliente_nombre, 'barrio', x.barrio,
        'total', x.total, 'mensajero', m.nombre) order by x.id), '[]')
      from privado.pedidos_del_dia(p_fecha) x left join public.usuarios m on m.id = x.mensajero_id
      where x.estado in ('por_alistar', 'alistado', 'despachado')),
    'separado_por', v_otro,
    'gastos', (select coalesce(sum(g.valor), 0) from public.gastos g where g.fecha = p_fecha),
    'mi_cierre', (select to_jsonb(k) from public.cierres_dia k where k.fecha = p_fecha and k.admin_id = v_yo and not k.anulado),
    'ahorro_total', (select coalesce(sum(k.ahorro), 0) from public.cierres_dia k where not k.anulado),
    'ahorro_mio', (select coalesce(sum(k.ahorro), 0) from public.cierres_dia k where not k.anulado and k.admin_id = v_yo),
    'ahorro', privado.ahorro_estado(),
    'semana', privado.comisiones_semana(p_fecha)
  );
end $function$;

create or replace function public.cerrar_dia3(p_fecha date, p_cuadres bigint[], p_cajas date[], p_ahorro_pct numeric,
  p_mercancia boolean default true, p_nota text default null)
 returns bigint language plpgsql security definer set search_path to ''
as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  v_cu bigint[] := coalesce(p_cuadres, '{}');
  v_ca date[] := coalesce(p_cajas, '{}');
  v_pct numeric := coalesce(p_ahorro_pct, 10);
  v_ef numeric; v_tr numeric; v_com numeric := 0; v_gan numeric := 0; v_cos numeric := 0; v_gas numeric; v_aho numeric := 0;
  v_id bigint; v_otro text; v_pend int;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'Ese día todavía no ha llegado'; end if;
  if v_pct < 0 or v_pct > 100 then raise exception 'El ahorro va de 0 %% a 100 %%'; end if;
  if exists (select 1 from public.cierres_dia where fecha = p_fecha and admin_id = v_yo and not anulado) then
    raise exception 'Ya cerraste este día. Anula el cierre para hacerlo de nuevo.';
  end if;
  select count(*) into v_pend from privado.pedidos_del_dia(p_fecha) x where x.estado in ('por_alistar', 'alistado', 'despachado');
  if v_pend > 0 then
    raise exception 'Hay % % de ese día sin entregar. Gestiónalos o pásalos al día siguiente para poder cerrar.', v_pend, case when v_pend = 1 then 'pedido' else 'pedidos' end;
  end if;
  if exists (select 1 from unnest(v_cu) x where not exists (select 1 from public.cuadres c where c.id = x and c.estado = 'confirmado' and c.fecha_entrega = p_fecha)) then
    raise exception 'Hay un cuadre que no es de ese día o que todavía no se ha confirmado';
  end if;
  if exists (select 1 from unnest(v_ca) x where x <> p_fecha or not exists (select 1 from public.cierres_caja k where k.fecha = x and k.recibido_at is not null)) then
    raise exception 'La caja del local de ese día todavía no se ha recibido';
  end if;
  select k.admin_nombre into v_otro from public.cierres_dia k where not k.anulado and (k.cuadres && v_cu or k.cajas && v_ca) limit 1;
  if v_otro is not null then raise exception '% ya puso parte de esa plata en su cierre', v_otro; end if;
  select coalesce(sum(c.total_efectivo - c.total_domicilios - coalesce(c.total_propinas, 0)), 0), coalesce(sum(c.total_transferencia), 0)
    into v_ef, v_tr from public.cuadres c where c.id = any(v_cu);
  v_ef := v_ef + (select coalesce(sum(coalesce(k.recibido, k.recoger, 0)), 0) from public.cierres_caja k where k.fecha = any(v_ca));
  -- Comisiones, ahorro y mercancía del día: solo en el primer cierre de ese día
  if not exists (select 1 from public.cierres_dia k where k.fecha = p_fecha and not k.anulado and (k.comisiones <> 0 or k.ahorro <> 0 or k.mercancia <> 0)) then
    select coalesce(sum(x.comision), 0), coalesce(sum(x.ganancia) filter (where x.estado = 'entregado'), 0), coalesce(sum(x.costo) filter (where x.estado = 'entregado'), 0)
      into v_com, v_gan, v_cos from privado.pedidos_del_dia(p_fecha) x;
    v_aho := round(greatest(v_gan, 0) * v_pct / 100);
    if not coalesce(p_mercancia, true) then v_cos := 0; end if;
  end if;
  v_gas := (select coalesce(sum(g.valor), 0) from public.gastos g where g.fecha = p_fecha);
  insert into public.cierres_dia (fecha, admin_id, admin_nombre, cuadres, cajas, efectivo, transferencia, comisiones, ganancia, ahorro_pct, ahorro, mercancia, gastos, libre, nota)
  values (p_fecha, v_yo, public.mi_nombre(), v_cu, v_ca, v_ef, v_tr, v_com, v_gan, v_pct, v_aho, v_cos, v_gas,
    v_ef + v_tr - v_com - v_aho - v_cos, nullif(trim(coalesce(p_nota, '')), ''))
  returning id into v_id;
  return v_id;
end $function$;

-- Pasar un pedido sin entregar al día siguiente (cuenta para ese día: comisiones, reportes, cierre)
create or replace function public.pasar_pedido_dia_siguiente(p_pedido bigint)
 returns date language plpgsql security definer set search_path to ''
as $function$
declare p public.pedidos; v_dia date;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Ese pedido no existe'; end if;
  if p.estado not in ('por_alistar', 'alistado', 'despachado') then raise exception 'Solo se pasan pedidos que no se han entregado'; end if;
  v_dia := (p.created_at at time zone 'America/Bogota')::date + 1;
  update public.pedidos set subido_at = coalesce(subido_at, created_at),
    created_at = (v_dia::text || ' 00:00 America/Bogota')::timestamptz + interval '1 second'
  where id = p_pedido;
  insert into public.pedido_notas (pedido_id, autor, nota)
  values (p_pedido, public.mi_nombre(), 'Pasado al día siguiente (' || to_char(v_dia, 'DD/MM/YYYY') || ') desde Mi cierre del día');
  return v_dia;
end $function$;

grant execute on function public.cerrar_dia3(date, bigint[], date[], numeric, boolean, text), public.pasar_pedido_dia_siguiente(bigint) to authenticated;
