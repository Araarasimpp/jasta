-- ============================================================================
--  Novedades de entrega, liquidación de vendedoras y gastos
--  Aplicado en Supabase: la parte de Novedades. Pendiente: liquidaciones y gastos.
-- ============================================================================

-- ---------------------------------------------------------------- Novedades
-- El mensajero no pudo entregar: queda el motivo y qué pasó con el pedido
-- (sigue en ruta para reintentar, o vuelve a la tienda como alistado sin mensajero).
create table if not exists public.pedido_novedades (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos(id) on delete cascade,
  mensajero_id bigint references public.usuarios(id),
  motivo text not null check (motivo in ('no_contesta', 'direccion', 'sin_dinero', 'no_estaba', 'rechazo', 'reprogramar', 'otro')),
  detalle text,
  accion text not null check (accion in ('reintentar', 'devolver')),
  autor text,
  created_at timestamptz not null default now()
);
create index if not exists pedido_novedades_pedido_idx on public.pedido_novedades (pedido_id);
create index if not exists pedido_novedades_fecha_idx on public.pedido_novedades (created_at desc);
alter table public.pedido_novedades enable row level security;
revoke all on public.pedido_novedades from anon, authenticated;

alter table public.pedidos add column if not exists novedades integer not null default 0;
alter table public.pedidos add column if not exists ultima_novedad text;
alter table public.pedidos add column if not exists novedad_at timestamptz;

create or replace function privado.motivo_novedad(p text) returns text language sql immutable set search_path to '' as $$
  select case p when 'no_contesta' then 'No contesta' when 'direccion' then 'Dirección errada'
    when 'sin_dinero' then 'No tenía la plata' when 'no_estaba' then 'No estaba' when 'rechazo' then 'No lo quiso recibir'
    when 'reprogramar' then 'Pidió otro día' else 'Otro motivo' end
$$;

create or replace function public.reportar_novedad(p_pedido bigint, p_motivo text, p_detalle text, p_accion text)
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_yo bigint := public.mi_usuario_id(); v_label text := privado.motivo_novedad(p_motivo); v_det text := nullif(trim(coalesce(p_detalle, '')), '');
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (p.mensajero_id = v_yo or public.tiene_rol('admin') or public.tiene_rol('alistador')) then raise exception 'Este pedido no está asignado a ti'; end if;
  if p.estado <> 'despachado' then raise exception 'El pedido no está en ruta'; end if;
  if p_motivo not in ('no_contesta', 'direccion', 'sin_dinero', 'no_estaba', 'rechazo', 'reprogramar', 'otro') then raise exception 'Motivo inválido'; end if;
  if p_accion not in ('reintentar', 'devolver') then raise exception 'Acción inválida'; end if;
  if p_motivo = 'otro' and v_det is null then raise exception 'Cuenta qué pasó'; end if;
  insert into public.pedido_novedades (pedido_id, mensajero_id, motivo, detalle, accion, autor)
  values (p.id, p.mensajero_id, p_motivo, left(v_det, 500), p_accion, public.mi_nombre());
  update public.pedidos set novedades = novedades + 1, ultima_novedad = v_label, novedad_at = now(), updated_at = now(),
    estado = case when p_accion = 'devolver' then 'alistado'::public.estado_pedido else estado end,
    mensajero_id = case when p_accion = 'devolver' then null else mensajero_id end,
    asignado_at = case when p_accion = 'devolver' then null else asignado_at end
  where id = p.id;
  perform public.nota(p.id, 'Novedad: ' || v_label || coalesce(' · ' || v_det, '')
    || case when p_accion = 'devolver' then ' · vuelve a la tienda' else ' · se reintenta' end);
  perform privado.avisar(array[p.vendedora_id] || privado.con_rol(array['admin', 'alistador']), 'novedad',
    'Novedad en el pedido #' || p.id, v_label || coalesce(': ' || v_det, '') || ' · ' || p.cliente_nombre
      || case when p_accion = 'devolver' then ' · vuelve a la tienda' else '' end,
    '/app/pedidos?id=' || p.id, p.id);
end $function$;
revoke execute on function public.reportar_novedad(bigint, text, text, text) from public, anon;
grant execute on function public.reportar_novedad(bigint, text, text, text) to authenticated;

-- Abiertas (pedidos con novedad que aún no se entregan ni cancelan) e historial del periodo
create or replace function public.novedades(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_yo bigint := public.mi_usuario_id();
  v_todo boolean := public.tiene_rol('admin') or public.tiene_rol('alistador') or public.tiene_rol('cuadres');
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'abiertas', (select coalesce(jsonb_agg(x order by x->>'novedad_at' desc), '[]') from (
      select jsonb_build_object('id', p.id, 'cliente_nombre', p.cliente_nombre, 'cliente_telefono', p.cliente_telefono, 'barrio', p.barrio,
        'direccion', p.direccion, 'total', p.total, 'estado', p.estado, 'novedades', p.novedades, 'ultima_novedad', p.ultima_novedad,
        'novedad_at', p.novedad_at, 'vendedora', v.nombre, 'mensajero', m.nombre,
        'detalle', (select n.detalle from public.pedido_novedades n where n.pedido_id = p.id order by n.id desc limit 1)) x
      from public.pedidos p left join public.usuarios v on v.id = p.vendedora_id left join public.usuarios m on m.id = p.mensajero_id
      where p.novedades > 0 and p.estado not in ('entregado', 'cancelado')
        and (v_todo or p.vendedora_id = v_yo or p.mensajero_id = v_yo)) s),
    'historial', (select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]') from (
      select jsonb_build_object('id', n.id, 'pedido_id', p.id, 'fecha', n.created_at, 'motivo', n.motivo, 'motivo_label', privado.motivo_novedad(n.motivo),
        'detalle', n.detalle, 'accion', n.accion, 'autor', n.autor, 'mensajero', m.nombre, 'cliente_nombre', p.cliente_nombre,
        'barrio', p.barrio, 'estado', p.estado, 'vendedora', v.nombre) x
      from public.pedido_novedades n join public.pedidos p on p.id = n.pedido_id
      left join public.usuarios m on m.id = n.mensajero_id left join public.usuarios v on v.id = p.vendedora_id
      where n.created_at >= d and n.created_at < h and (v_todo or p.vendedora_id = v_yo or n.mensajero_id = v_yo)
      limit 300) s),
    'por_motivo', (select coalesce(jsonb_agg(jsonb_build_object('motivo', privado.motivo_novedad(motivo), 'n', c) order by c desc), '[]') from (
      select n.motivo, count(*) c from public.pedido_novedades n join public.pedidos p on p.id = n.pedido_id
      where n.created_at >= d and n.created_at < h and (v_todo or p.vendedora_id = v_yo or n.mensajero_id = v_yo) group by 1) s),
    'por_mensajero', (select coalesce(jsonb_agg(jsonb_build_object('nombre', coalesce(m.nombre, '—'), 'n', c) order by c desc), '[]') from (
      select n.mensajero_id, count(*) c from public.pedido_novedades n join public.pedidos p on p.id = n.pedido_id
      where n.created_at >= d and n.created_at < h and (v_todo or p.vendedora_id = v_yo or n.mensajero_id = v_yo) group by 1) s
      left join public.usuarios m on m.id = s.mensajero_id)
  );
end $function$;
revoke execute on function public.novedades(date, date) from public, anon;
grant execute on function public.novedades(date, date) to authenticated;

-- ---------------------------------------------------------------- Liquidación de vendedoras
-- Comisión de un pedido entregado = (precio venta − precio base) × cantidad − aporte a la alcancía.
-- Solo cuentan los entregados desde configuracion.liquidar_desde (lo anterior ya se pagó por fuera).
alter table public.configuracion add column if not exists liquidar_desde date;
update public.configuracion set liquidar_desde = coalesce(liquidar_desde, (now() at time zone 'America/Bogota')::date);

create table if not exists public.liquidaciones (
  id bigint generated always as identity primary key,
  vendedora_id bigint not null references public.usuarios(id),
  desde date, hasta date,
  cantidad_pedidos integer not null default 0,
  total numeric not null default 0,
  metodo text not null default 'transferencia' check (metodo in ('efectivo', 'transferencia', 'otro')),
  comprobantes text[] not null default '{}',
  nota text,
  pagado_at timestamptz not null default now(),
  pagado_por bigint references public.usuarios(id),
  pagado_por_nombre text,
  anulada boolean not null default false
);
create index if not exists liquidaciones_vendedora_idx on public.liquidaciones (vendedora_id, pagado_at desc);
alter table public.liquidaciones enable row level security;
revoke all on public.liquidaciones from anon, authenticated;
grant select on public.liquidaciones to authenticated;
create policy liquidaciones_ver on public.liquidaciones for select to authenticated
  using ((select public.tiene_rol('admin')) or vendedora_id = (select public.mi_usuario_id()));

alter table public.pedidos add column if not exists liquidacion_id bigint references public.liquidaciones(id);
create index if not exists pedidos_liquidacion_idx on public.pedidos (vendedora_id) where liquidacion_id is null and estado = 'entregado';

-- La vendedora ve el comprobante de lo que le pagaron
create policy comprobantes_ver_liquidacion on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and exists (select 1 from public.liquidaciones l
    where ('sb://comprobantes/' || objects.name) = any (l.comprobantes) and l.vendedora_id = (select public.mi_usuario_id())));

create or replace function privado.comision(p_pedido bigint) returns numeric language sql stable security definer set search_path to '' as $$
  select coalesce((select sum((i.precio_venta - i.precio_base) * i.cantidad) from public.pedido_items i where i.pedido_id = p_pedido), 0)
       - coalesce((select aporte_alcancia from public.pedidos where id = p_pedido), 0)
$$;

-- Pedidos por liquidar (de una vendedora, o de todas para el admin)
create or replace function privado.por_liquidar(p_vendedora bigint)
returns table(id bigint, vendedora_id bigint, dia date, comision numeric, cliente_nombre text, total numeric)
language sql stable security definer set search_path to '' as $$
  select p.id, p.vendedora_id, (coalesce(p.entregado_at, p.created_at) at time zone 'America/Bogota')::date, privado.comision(p.id), p.cliente_nombre, p.total
  from public.pedidos p
  where p.estado = 'entregado' and p.liquidacion_id is null and p.vendedora_id is not null
    and (p_vendedora is null or p.vendedora_id = p_vendedora)
    and (coalesce(p.entregado_at, p.created_at) at time zone 'America/Bogota')::date >= coalesce((select liquidar_desde from public.configuracion limit 1), '2000-01-01')
$$;

create or replace function public.liquidaciones_pendientes()
returns table(vendedora_id bigint, nombre text, pedidos bigint, total numeric, desde date, hasta date)
language plpgsql stable security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  return query
    select x.vendedora_id, u.nombre, count(*), sum(x.comision), min(x.dia), max(x.dia)
    from privado.por_liquidar(case when public.tiene_rol('admin') then null else v_yo end) x join public.usuarios u on u.id = x.vendedora_id
    group by 1, 2 order by 4 desc;
end $function$;
revoke execute on function public.liquidaciones_pendientes() from public, anon;
grant execute on function public.liquidaciones_pendientes() to authenticated;

-- Pedidos de una liquidación (o los pendientes de la vendedora si p_liquidacion es null)
create or replace function public.liquidacion_pedidos(p_vendedora bigint, p_liquidacion bigint)
returns table(id bigint, dia date, cliente_nombre text, total numeric, comision numeric)
language plpgsql stable security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null or not (public.tiene_rol('admin') or p_vendedora = v_yo) then raise exception 'Sin permiso'; end if;
  if p_liquidacion is null then
    return query select x.id, x.dia, x.cliente_nombre, x.total, x.comision from privado.por_liquidar(p_vendedora) x order by x.dia, x.id;
  else
    return query select p.id, (coalesce(p.entregado_at, p.created_at) at time zone 'America/Bogota')::date, p.cliente_nombre, p.total, privado.comision(p.id)
      from public.pedidos p where p.liquidacion_id = p_liquidacion and p.vendedora_id = p_vendedora order by 2, 1;
  end if;
end $function$;
revoke execute on function public.liquidacion_pedidos(bigint, bigint) from public, anon;
grant execute on function public.liquidacion_pedidos(bigint, bigint) to authenticated;

-- El admin paga lo pendiente de una vendedora hasta un día (incluido)
create or replace function public.pagar_liquidacion(p_vendedora bigint, p_hasta date, p_metodo text, p_comprobantes text[], p_nota text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_ev text[]; v_n int; v_total numeric; v_desde date; v_hasta date;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin registra pagos a vendedoras'; end if;
  if p_metodo not in ('efectivo', 'transferencia', 'otro') then raise exception 'Forma de pago inválida'; end if;
  v_ev := privado.comprobantes_validos(p_comprobantes);
  select count(*), coalesce(sum(comision), 0), min(dia), max(dia) into v_n, v_total, v_desde, v_hasta
    from privado.por_liquidar(p_vendedora) where dia <= p_hasta;
  if v_n = 0 then raise exception 'No hay comisiones pendientes hasta ese día'; end if;
  insert into public.liquidaciones (vendedora_id, desde, hasta, cantidad_pedidos, total, metodo, comprobantes, nota, pagado_por, pagado_por_nombre)
  values (p_vendedora, v_desde, v_hasta, v_n, v_total, p_metodo, v_ev, nullif(trim(coalesce(p_nota, '')), ''), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  update public.pedidos set liquidacion_id = v_id where id in (select id from privado.por_liquidar(p_vendedora) where dia <= p_hasta);
  perform privado.avisar(array[p_vendedora], 'liquidacion', 'Te pagaron tus comisiones',
    '$' || replace(to_char(v_total, 'FM999,999,999,990'), ',', '.') || ' · ' || v_n || ' pedidos · ' || p_metodo, '/app/comisiones', null);
  return v_id;
end $function$;
revoke execute on function public.pagar_liquidacion(bigint, date, text, text[], text) from public, anon;
grant execute on function public.pagar_liquidacion(bigint, date, text, text[], text) to authenticated;

-- Pago registrado por error: sus pedidos vuelven a quedar pendientes
create or replace function public.anular_liquidacion(p_id bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede anular un pago'; end if;
  update public.liquidaciones set anulada = true where id = p_id and not anulada;
  if not found then raise exception 'El pago no existe o ya estaba anulado'; end if;
  update public.pedidos set liquidacion_id = null where liquidacion_id = p_id;
end $function$;
revoke execute on function public.anular_liquidacion(bigint) from public, anon;
grant execute on function public.anular_liquidacion(bigint) to authenticated;

create or replace function public.guardar_liquidar_desde(p_dia date)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if p_dia is null then raise exception 'Elige un día'; end if;
  update public.configuracion set liquidar_desde = p_dia;
end $function$;
revoke execute on function public.guardar_liquidar_desde(date) from public, anon;
grant execute on function public.guardar_liquidar_desde(date) to authenticated;

create or replace function public.liquidar_desde()
returns date language sql stable security definer set search_path to '' as $$ select liquidar_desde from public.configuracion limit 1 $$;
revoke execute on function public.liquidar_desde() from public, anon;
grant execute on function public.liquidar_desde() to authenticated;

-- ---------------------------------------------------------------- Gastos
create table if not exists public.gastos (
  id bigint generated always as identity primary key,
  fecha date not null,
  categoria text not null check (categoria in ('arriendo', 'nomina', 'publicidad', 'transporte', 'empaques', 'servicios', 'mantenimiento', 'impuestos', 'otros')),
  descripcion text not null,
  valor numeric not null check (valor > 0),
  metodo text not null default 'efectivo' check (metodo in ('efectivo', 'transferencia', 'otro')),
  comprobantes text[] not null default '{}',
  creado_por bigint references public.usuarios(id),
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists gastos_fecha_idx on public.gastos (fecha desc);
alter table public.gastos enable row level security;
revoke all on public.gastos from anon, authenticated;

create or replace function public.registrar_gasto(p_fecha date, p_categoria text, p_descripcion text, p_valor numeric, p_metodo text, p_comprobantes text[])
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin registra gastos'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Escribe el valor del gasto'; end if;
  if nullif(trim(coalesce(p_descripcion, '')), '') is null then raise exception 'Escribe en qué se gastó'; end if;
  insert into public.gastos (fecha, categoria, descripcion, valor, metodo, comprobantes, creado_por, creado_por_nombre)
  values (coalesce(p_fecha, (now() at time zone 'America/Bogota')::date), p_categoria, left(trim(p_descripcion), 300), p_valor,
          coalesce(p_metodo, 'efectivo'), privado.comprobantes_validos(p_comprobantes), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  return v_id;
end $function$;
revoke execute on function public.registrar_gasto(date, text, text, numeric, text, text[]) from public, anon;
grant execute on function public.registrar_gasto(date, text, text, numeric, text, text[]) to authenticated;

create or replace function public.quitar_gasto(p_id bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede quitar gastos'; end if;
  delete from public.gastos where id = p_id;
  if not found then raise exception 'El gasto ya no existe'; end if;
end $function$;
revoke execute on function public.quitar_gasto(bigint) from public, anon;
grant execute on function public.quitar_gasto(bigint) to authenticated;

-- Gastos del periodo y la utilidad real (ganancia de la tienda − gastos)
create or replace function public.gastos_resumen(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_gan numeric; v_gastos numeric;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  -- Igual que ganancia_por_dia (lo que usa el Inicio): pedidos entregados creados en el periodo
  select coalesce(sum((i.precio_base - i.precio_compra) * i.cantidad), 0) into v_gan
    from public.pedidos p join public.pedido_items i on i.pedido_id = p.id
   where p.estado = 'entregado' and p.created_at >= d and p.created_at < h;
  select coalesce(sum(valor), 0) into v_gastos from public.gastos where fecha between p_desde and p_hasta;
  return jsonb_build_object(
    'ganancia_tienda', v_gan,
    'gastos', v_gastos,
    'utilidad', v_gan - v_gastos,
    'por_categoria', (select coalesce(jsonb_agg(jsonb_build_object('categoria', categoria, 'total', t, 'n', n) order by t desc), '[]')
      from (select categoria, sum(valor) t, count(*) n from public.gastos where fecha between p_desde and p_hasta group by 1) s),
    'lista', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'fecha', fecha, 'categoria', categoria, 'descripcion', descripcion, 'valor', valor,
        'metodo', metodo, 'comprobantes', comprobantes, 'creado_por_nombre', creado_por_nombre, 'created_at', created_at) order by fecha desc, id desc), '[]')
      from public.gastos where fecha between p_desde and p_hasta)
  );
end $function$;
revoke execute on function public.gastos_resumen(date, date) from public, anon;
grant execute on function public.gastos_resumen(date, date) to authenticated;
