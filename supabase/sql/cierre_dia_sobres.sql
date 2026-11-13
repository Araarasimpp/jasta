-- YA APLICADO (2026-11-13). Queda aquí como registro.
-- Mi cierre del día, segunda parte: sobre de mercancía, meta de ahorro (con retiros)
-- y sobre de comisiones de la semana (sábado a viernes).

alter table public.cierres_dia add column if not exists mercancia numeric not null default 0;
alter table public.configuracion add column if not exists ahorro_meta numeric;

create table if not exists public.ahorro_retiros (
  id bigint generated always as identity primary key,
  fecha date not null default (now() at time zone 'America/Bogota')::date,
  valor numeric not null check (valor > 0),
  motivo text not null,
  admin_id bigint not null references public.usuarios(id),
  admin_nombre text not null,
  created_at timestamptz not null default now(),
  anulado boolean not null default false
);
alter table public.ahorro_retiros enable row level security;

-- Igual que cierre_pedidos, con el costo de la mercancía de cada pedido
create or replace function privado.cierre_pedidos2(p_cuadres bigint[], p_cajas date[])
 returns table(pedido_id bigint, comision numeric, ganancia numeric, costo numeric)
 language sql stable security definer set search_path to ''
as $function$
  select p.id, case when p.vendedora_id is not null then privado.comision(p.id) else 0 end,
    coalesce(v.ganancia_tienda, 0), coalesce(v.costo, 0)
  from public.pedidos p left join public.ventas_pedidos v on v.id = p.id
  where p.estado = 'entregado' and (p.cuadre_id = any(p_cuadres)
    or (p.canal = 'local' and (p.created_at at time zone 'America/Bogota')::date = any(p_cajas)))
$function$;

-- Ahorro: lo guardado en los cierres menos lo que se ha sacado
create or replace function privado.ahorro_estado()
 returns jsonb language sql stable security definer set search_path to ''
as $function$
  select jsonb_build_object(
    'guardado', (select coalesce(sum(ahorro), 0) from public.cierres_dia where not anulado),
    'retirado', (select coalesce(sum(valor), 0) from public.ahorro_retiros where not anulado),
    'meta', (select ahorro_meta from public.configuracion limit 1),
    'retiros', (select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]')
      from (select id, fecha, valor, motivo, admin_nombre, created_at from public.ahorro_retiros where not anulado order by created_at desc limit 20) r))
$function$;

-- Comisiones de la semana de pago (sábado a viernes): lo que toca pagar y lo que ya se separó
create or replace function privado.comisiones_semana(p_fecha date)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_sab date := p_fecha - ((extract(dow from p_fecha)::int + 1) % 7);
  v_vie date := v_sab + 6;
begin
  return jsonb_build_object('desde', v_sab, 'hasta', v_vie,
    'a_pagar', (select coalesce(sum(x.c), 0) from (
        select l.comision c from privado.por_liquidar(null) l where l.dia between v_sab and v_vie
        union all select dl.comision from privado.descuentos_por_liquidar(null) dl where dl.dia between v_sab and v_vie) x),
    'atrasadas', (select coalesce(sum(x.c), 0) from (
        select l.comision c from privado.por_liquidar(null) l where l.dia < v_sab
        union all select dl.comision from privado.descuentos_por_liquidar(null) dl where dl.dia < v_sab) x),
    'separado', (select coalesce(sum(k.comisiones), 0) from public.cierres_dia k where not k.anulado and k.fecha between v_sab and v_vie));
end $function$;

create or replace function public.cierre_dia_datos(p_fecha date)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  d timestamptz := (p_fecha::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_fecha + 1)::text || ' 00:00 America/Bogota')::timestamptz;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'cuadres', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'mensajero', u.nombre, 'pedidos', c.cantidad_pedidos, 'fecha_entrega', c.fecha_entrega,
        'efectivo', c.total_efectivo - c.total_domicilios - coalesce(c.total_propinas, 0), 'transferencia', c.total_transferencia,
        'recibio', c.confirmado_por_nombre, 'recibio_id', c.confirmado_por, 'hora', c.confirmado_at,
        'comisiones', s.comisiones, 'ganancia', s.ganancia, 'costo', s.costo,
        'en_cierre', (select k.admin_nombre from public.cierres_dia k where not k.anulado and c.id = any(k.cuadres) limit 1)
      ) order by c.confirmado_at), '[]')
      from public.cuadres c left join public.usuarios u on u.id = c.mensajero_id
      cross join lateral (select coalesce(sum(x.comision), 0) comisiones, coalesce(sum(x.ganancia), 0) ganancia, coalesce(sum(x.costo), 0) costo
        from privado.cierre_pedidos2(array[c.id], '{}') x) s
      where c.estado = 'confirmado' and c.confirmado_at >= d and c.confirmado_at < h),
    'cajas', (select coalesce(jsonb_agg(jsonb_build_object(
        'fecha', k.fecha, 'efectivo', coalesce(k.recibido, k.recoger, 0), 'recibio', k.recibido_por, 'hora', k.recibido_at,
        'comisiones', s.comisiones, 'ganancia', s.ganancia, 'costo', s.costo,
        'en_cierre', (select z.admin_nombre from public.cierres_dia z where not z.anulado and k.fecha = any(z.cajas) limit 1)
      ) order by k.recibido_at), '[]')
      from public.cierres_caja k
      cross join lateral (select coalesce(sum(x.comision), 0) comisiones, coalesce(sum(x.ganancia), 0) ganancia, coalesce(sum(x.costo), 0) costo
        from privado.cierre_pedidos2('{}', array[k.fecha]) x) s
      where k.recibido_at >= d and k.recibido_at < h),
    'dia', (select jsonb_build_object('pedidos', count(*), 'ventas', coalesce(sum(v.total), 0),
        'ganancia', coalesce(sum(v.ganancia_tienda), 0), 'comisiones', coalesce(sum(v.ganancia_vendedora), 0))
      from public.ventas_pedidos v where v.estado = 'entregado' and v.entregado_at >= d and v.entregado_at < h),
    'gastos', (select coalesce(sum(g.valor), 0) from public.gastos g where g.fecha = p_fecha),
    'mi_cierre', (select to_jsonb(k) from public.cierres_dia k where k.fecha = p_fecha and k.admin_id = v_yo and not k.anulado),
    'ahorro_total', (select coalesce(sum(k.ahorro), 0) from public.cierres_dia k where not k.anulado),
    'ahorro_mio', (select coalesce(sum(k.ahorro), 0) from public.cierres_dia k where not k.anulado and k.admin_id = v_yo),
    'ahorro', privado.ahorro_estado(),
    'semana', privado.comisiones_semana(p_fecha)
  );
end $function$;

create or replace function public.cerrar_dia2(p_fecha date, p_cuadres bigint[], p_cajas date[], p_ahorro_pct numeric,
  p_mercancia boolean default true, p_nota text default null)
 returns bigint language plpgsql security definer set search_path to ''
as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  d timestamptz := (p_fecha::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_fecha + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_cu bigint[] := coalesce(p_cuadres, '{}');
  v_ca date[] := coalesce(p_cajas, '{}');
  v_pct numeric := coalesce(p_ahorro_pct, 10);
  v_ef numeric; v_tr numeric; v_com numeric; v_gan numeric; v_cos numeric; v_gas numeric; v_aho numeric; v_id bigint; v_otro text;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'Ese día todavía no ha llegado'; end if;
  if v_pct < 0 or v_pct > 100 then raise exception 'El ahorro va de 0 %% a 100 %%'; end if;
  if exists (select 1 from public.cierres_dia where fecha = p_fecha and admin_id = v_yo and not anulado) then
    raise exception 'Ya cerraste este día. Anula el cierre para hacerlo de nuevo.';
  end if;
  if exists (select 1 from unnest(v_cu) x where not exists (select 1 from public.cuadres c where c.id = x and c.estado = 'confirmado' and c.confirmado_at >= d and c.confirmado_at < h)) then
    raise exception 'Hay un cuadre que no es de ese día';
  end if;
  if exists (select 1 from unnest(v_ca) x where not exists (select 1 from public.cierres_caja k where k.fecha = x and k.recibido_at >= d and k.recibido_at < h)) then
    raise exception 'Hay una caja del local que no es de ese día';
  end if;
  select k.admin_nombre into v_otro from public.cierres_dia k where not k.anulado and (k.cuadres && v_cu or k.cajas && v_ca) limit 1;
  if v_otro is not null then raise exception '% ya puso parte de esa plata en su cierre', v_otro; end if;
  select coalesce(sum(c.total_efectivo - c.total_domicilios - coalesce(c.total_propinas, 0)), 0), coalesce(sum(c.total_transferencia), 0)
    into v_ef, v_tr from public.cuadres c where c.id = any(v_cu);
  v_ef := v_ef + (select coalesce(sum(coalesce(k.recibido, k.recoger, 0)), 0) from public.cierres_caja k where k.fecha = any(v_ca));
  select coalesce(sum(x.comision), 0), coalesce(sum(x.ganancia), 0), coalesce(sum(x.costo), 0) into v_com, v_gan, v_cos
    from privado.cierre_pedidos2(v_cu, v_ca) x;
  if not coalesce(p_mercancia, true) then v_cos := 0; end if;
  v_gas := (select coalesce(sum(g.valor), 0) from public.gastos g where g.fecha = p_fecha);
  v_aho := round(greatest(v_gan, 0) * v_pct / 100);
  insert into public.cierres_dia (fecha, admin_id, admin_nombre, cuadres, cajas, efectivo, transferencia, comisiones, ganancia, ahorro_pct, ahorro, mercancia, gastos, libre, nota)
  values (p_fecha, v_yo, public.mi_nombre(), v_cu, v_ca, v_ef, v_tr, v_com, v_gan, v_pct, v_aho, v_cos, v_gas,
    v_ef + v_tr - v_com - v_aho - v_cos, nullif(trim(coalesce(p_nota, '')), ''))
  returning id into v_id;
  return v_id;
end $function$;

create or replace function public.guardar_meta_ahorro(p_meta numeric)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if p_meta is not null and (p_meta < 0 or p_meta > 100000000000) then raise exception 'Meta no válida'; end if;
  update public.configuracion set ahorro_meta = nullif(p_meta, 0);
end $function$;

create or replace function public.retirar_ahorro(p_valor numeric, p_motivo text)
 returns bigint language plpgsql security definer set search_path to ''
as $function$
declare v_id bigint; v_saldo numeric;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Escribe cuánto sacaste'; end if;
  if length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe para qué se sacó'; end if;
  v_saldo := (select coalesce(sum(ahorro), 0) from public.cierres_dia where not anulado)
           - (select coalesce(sum(valor), 0) from public.ahorro_retiros where not anulado);
  if p_valor > v_saldo then raise exception 'En el ahorro solo hay %', to_char(v_saldo, 'FM999G999G999'); end if;
  insert into public.ahorro_retiros (valor, motivo, admin_id, admin_nombre)
  values (round(p_valor), left(trim(p_motivo), 200), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  return v_id;
end $function$;

create or replace function public.anular_retiro_ahorro(p_id bigint)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  update public.ahorro_retiros set anulado = true where id = p_id and not anulado;
end $function$;

grant execute on function public.cerrar_dia2(date, bigint[], date[], numeric, boolean, text), public.guardar_meta_ahorro(numeric),
  public.retirar_ahorro(numeric, text), public.anular_retiro_ahorro(bigint) to authenticated;
