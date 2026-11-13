-- YA APLICADO (2026-11-13). Queda aquí como registro.
-- Cierre del día del administrador: marca qué plata recibió él mismo (cuadres de mensajeros
-- y caja del local), cuánto separar para las comisiones de las vendedoras y cuánto ahorrar.

create table if not exists public.cierres_dia (
  id bigint generated always as identity primary key,
  fecha date not null,
  admin_id bigint not null references public.usuarios(id),
  admin_nombre text not null,
  cuadres bigint[] not null default '{}',
  cajas date[] not null default '{}',
  efectivo numeric not null default 0,
  transferencia numeric not null default 0,
  comisiones numeric not null default 0,
  ganancia numeric not null default 0,
  ahorro_pct numeric not null default 10,
  ahorro numeric not null default 0,
  gastos numeric not null default 0,
  libre numeric not null default 0,
  nota text,
  created_at timestamptz not null default now(),
  anulado boolean not null default false,
  anulado_at timestamptz
);
alter table public.cierres_dia enable row level security;
create unique index if not exists cierres_dia_uno on public.cierres_dia (fecha, admin_id) where not anulado;

-- Pedidos con su comisión y ganancia de la tienda (de un cuadre o de la caja del local de un día)
create or replace function privado.cierre_pedidos(p_cuadres bigint[], p_cajas date[])
 returns table(pedido_id bigint, cuadre_id bigint, caja date, comision numeric, ganancia numeric)
 language sql stable security definer set search_path to ''
as $function$
  select p.id, p.cuadre_id, null::date,
    case when p.vendedora_id is not null then privado.comision(p.id) else 0 end, coalesce(v.ganancia_tienda, 0)
  from public.pedidos p left join public.ventas_pedidos v on v.id = p.id
  where p.cuadre_id = any(p_cuadres) and p.estado = 'entregado'
  union all
  select p.id, null, (p.created_at at time zone 'America/Bogota')::date,
    case when p.vendedora_id is not null then privado.comision(p.id) else 0 end, coalesce(v.ganancia_tienda, 0)
  from public.pedidos p left join public.ventas_pedidos v on v.id = p.id
  where p.canal = 'local' and p.estado = 'entregado'
    and (p.created_at at time zone 'America/Bogota')::date = any(p_cajas)
$function$;

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
        'comisiones', (select coalesce(sum(x.comision), 0) from privado.cierre_pedidos(array[c.id], '{}') x),
        'ganancia', (select coalesce(sum(x.ganancia), 0) from privado.cierre_pedidos(array[c.id], '{}') x),
        'en_cierre', (select k.admin_nombre from public.cierres_dia k where not k.anulado and c.id = any(k.cuadres) limit 1)
      ) order by c.confirmado_at), '[]')
      from public.cuadres c left join public.usuarios u on u.id = c.mensajero_id
      where c.estado = 'confirmado' and c.confirmado_at >= d and c.confirmado_at < h),
    'cajas', (select coalesce(jsonb_agg(jsonb_build_object(
        'fecha', k.fecha, 'efectivo', coalesce(k.recibido, k.recoger, 0), 'recibio', k.recibido_por, 'hora', k.recibido_at,
        'comisiones', (select coalesce(sum(x.comision), 0) from privado.cierre_pedidos('{}', array[k.fecha]) x),
        'ganancia', (select coalesce(sum(x.ganancia), 0) from privado.cierre_pedidos('{}', array[k.fecha]) x),
        'en_cierre', (select z.admin_nombre from public.cierres_dia z where not z.anulado and k.fecha = any(z.cajas) limit 1)
      ) order by k.recibido_at), '[]')
      from public.cierres_caja k where k.recibido_at >= d and k.recibido_at < h),
    'dia', (select jsonb_build_object('pedidos', count(*), 'ventas', coalesce(sum(v.total), 0),
        'ganancia', coalesce(sum(v.ganancia_tienda), 0), 'comisiones', coalesce(sum(v.ganancia_vendedora), 0))
      from public.ventas_pedidos v where v.estado = 'entregado' and v.entregado_at >= d and v.entregado_at < h),
    'gastos', (select coalesce(sum(g.valor), 0) from public.gastos g where g.fecha = p_fecha),
    'mi_cierre', (select to_jsonb(k) from public.cierres_dia k where k.fecha = p_fecha and k.admin_id = v_yo and not k.anulado),
    'ahorro_total', (select coalesce(sum(k.ahorro), 0) from public.cierres_dia k where not k.anulado),
    'ahorro_mio', (select coalesce(sum(k.ahorro), 0) from public.cierres_dia k where not k.anulado and k.admin_id = v_yo)
  );
end $function$;

create or replace function public.cerrar_dia(p_fecha date, p_cuadres bigint[], p_cajas date[], p_ahorro_pct numeric, p_nota text default null)
 returns bigint language plpgsql security definer set search_path to ''
as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  d timestamptz := (p_fecha::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_fecha + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_cu bigint[] := coalesce(p_cuadres, '{}');
  v_ca date[] := coalesce(p_cajas, '{}');
  v_pct numeric := coalesce(p_ahorro_pct, 10);
  v_ef numeric; v_tr numeric; v_com numeric; v_gan numeric; v_gas numeric; v_aho numeric; v_id bigint; v_otro text;
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
  select coalesce(sum(x.comision), 0), coalesce(sum(x.ganancia), 0) into v_com, v_gan from privado.cierre_pedidos(v_cu, v_ca) x;
  v_gas := (select coalesce(sum(g.valor), 0) from public.gastos g where g.fecha = p_fecha);
  v_aho := round(greatest(v_gan, 0) * v_pct / 100);
  insert into public.cierres_dia (fecha, admin_id, admin_nombre, cuadres, cajas, efectivo, transferencia, comisiones, ganancia, ahorro_pct, ahorro, gastos, libre, nota)
  values (p_fecha, v_yo, public.mi_nombre(), v_cu, v_ca, v_ef, v_tr, v_com, v_gan, v_pct, v_aho, v_gas, v_ef + v_tr - v_com - v_aho, nullif(trim(coalesce(p_nota, '')), ''))
  returning id into v_id;
  return v_id;
end $function$;

create or replace function public.anular_cierre_dia(p_id bigint)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  update public.cierres_dia set anulado = true, anulado_at = now()
   where id = p_id and admin_id = public.mi_usuario_id() and not anulado;
  if not found then raise exception 'Solo puedes anular tus propios cierres'; end if;
end $function$;

create or replace function public.cierres_dia_lista(p_limite int default 30)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(k) order by k.fecha desc, k.id desc), '[]')
    from (select * from public.cierres_dia where not anulado order by fecha desc, id desc limit least(greatest(p_limite, 1), 200)) k);
end $function$;

grant execute on function public.cierre_dia_datos(date), public.cerrar_dia(date, bigint[], date[], numeric, text),
  public.anular_cierre_dia(bigint), public.cierres_dia_lista(int) to authenticated;
