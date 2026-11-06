-- Recolector: cada uno con su base y su saldo, y el admin recibe lo que debe tener (PENDIENTE: córrelo en el SQL Editor de Supabase)
-- * Saldo de cada recolector (lo que debe tener en la mano, sumando todos los días):
--   bases aceptadas − compras − lo que ya le entregó al admin.
-- * El admin registra cuánto recibió (puede ser todo o una parte); le llega un aviso al recolector.
-- * El resumen trae una tarjeta por recolector (antes, "Todos" sumaba las bases de todos en una sola).

create table if not exists public.recoleccion_entregas (
  id bigint generated always as identity primary key,
  recolector_id bigint not null references public.usuarios(id),
  valor numeric not null check (valor > 0 and valor <= 100000000),
  nota text,
  recibida_por bigint references public.usuarios(id),
  recibida_por_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists recoleccion_entregas_rec_idx on public.recoleccion_entregas (recolector_id, created_at desc);
alter table public.recoleccion_entregas enable row level security;
drop policy if exists recoleccion_entregas_ver on public.recoleccion_entregas;
create policy recoleccion_entregas_ver on public.recoleccion_entregas for select to authenticated
  using ((select public.tiene_rol('admin')) or (select public.tiene_rol('cuadres')) or recolector_id = (select public.mi_usuario_id()));
grant select on public.recoleccion_entregas to authenticated;
do $$ begin
  alter publication supabase_realtime add table public.recoleccion_entregas;
exception when duplicate_object then null; end $$;

-- Lo que debe tener cada recolector ahora (todos los días)
create or replace function privado.recoleccion_saldo(p_rec bigint)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(monto) from public.recoleccion_bases where recolector_id = p_rec and estado = 'aceptada'), 0)
       - coalesce((select sum(valor) from public.recoleccion_compras where recolector_id = p_rec), 0)
       - coalesce((select sum(valor) from public.recoleccion_entregas where recolector_id = p_rec), 0)
$$;
revoke execute on function privado.recoleccion_saldo(bigint) from public, anon, authenticated;

-- El admin recibe plata de un recolector
create or replace function public.recoleccion_recibir(p_recolector bigint, p_valor numeric, p_nota text)
returns numeric language plpgsql security definer set search_path = '' as $fn$
declare v_valor numeric := round(coalesce(p_valor, 0)); v_saldo numeric;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin recibe la plata del recolector'; end if;
  if not exists (select 1 from public.usuarios where id = p_recolector and 'recolector' = any(roles)) then raise exception 'Ese recolector no existe'; end if;
  if v_valor <= 0 then raise exception 'Escribe cuánto recibiste'; end if;
  insert into public.recoleccion_entregas (recolector_id, valor, nota, recibida_por, recibida_por_nombre)
  values (p_recolector, v_valor, nullif(left(trim(coalesce(p_nota, '')), 300), ''), public.mi_usuario_id(), public.mi_nombre());
  v_saldo := privado.recoleccion_saldo(p_recolector);
  perform privado.avisar(array[p_recolector], 'base_recolector',
    coalesce(public.mi_nombre(), 'El admin') || ' recibió $' || replace(to_char(v_valor, 'FM999G999G999'), ',', '.'),
    case when v_saldo = 0 then 'Quedaste en cero ✓' when v_saldo > 0 then 'Todavía debes tener $' || replace(to_char(v_saldo, 'FM999G999G999'), ',', '.')
         else 'Quedó a tu favor $' || replace(to_char(-v_saldo, 'FM999G999G999'), ',', '.') end, '/app/recolector', null);
  return v_saldo;
end $fn$;

-- Borrar una entrega registrada por error (admin)
create or replace function public.recoleccion_borrar_entrega(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $fn$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  delete from public.recoleccion_entregas where id = p_id;
  if not found then raise exception 'Esa entrega ya no existe'; end if;
end $fn$;

-- Resumen del día (con lo entregado) y, para el admin, una tarjeta por recolector
create or replace function public.recoleccion_resumen(p_desde date, p_hasta date, p_recolector bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_admin boolean := public.tiene_rol('admin') or public.tiene_rol('cuadres');
  v_rec bigint;
begin
  if v_admin then v_rec := p_recolector;
  elsif public.tiene_rol('recolector') then v_rec := public.mi_usuario_id();
  else raise exception 'Sin permiso'; end if;
  if p_hasta < p_desde or p_hasta - p_desde > 400 then raise exception 'Rango de fechas inválido (máximo 400 días)'; end if;
  return jsonb_build_object(
    'base', (select coalesce(sum(monto), 0) from public.recoleccion_bases where estado = 'aceptada'
             and (v_rec is null or recolector_id = v_rec) and created_at >= d and created_at < h),
    'compras', (select coalesce(sum(valor), 0) from public.recoleccion_compras
             where (v_rec is null or recolector_id = v_rec) and created_at >= d and created_at < h),
    'entregado', (select coalesce(sum(valor), 0) from public.recoleccion_entregas
             where (v_rec is null or recolector_id = v_rec) and created_at >= d and created_at < h),
    'saldo', case when v_rec is not null then privado.recoleccion_saldo(v_rec) end,
    'n_compras', (select count(*) from public.recoleccion_compras where (v_rec is null or recolector_id = v_rec) and created_at >= d and created_at < h),
    'n_bases', (select count(*) from public.recoleccion_bases where estado = 'aceptada' and (v_rec is null or recolector_id = v_rec) and created_at >= d and created_at < h),
    'pendientes', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'monto', b.monto, 'nombre', b.nombre, 'de', b.creada_por_nombre,
                     'recolector', u.nombre, 'fecha', b.created_at) order by b.created_at), '[]')
                   from public.recoleccion_bases b join public.usuarios u on u.id = b.recolector_id
                   where b.estado = 'pendiente' and (v_rec is null or b.recolector_id = v_rec)),
    'movimientos', (select coalesce(jsonb_agg(m order by m.fecha desc), '[]') from (
        select 'base' tipo, b.id, b.created_at fecha, b.monto valor, b.nombre, b.estado, b.creada_por_nombre quien, u.nombre recolector,
               null::text proveedor, null::text producto, null::text[] facturas
        from public.recoleccion_bases b join public.usuarios u on u.id = b.recolector_id
        where (v_rec is null or b.recolector_id = v_rec) and b.created_at >= d and b.created_at < h
        union all
        select 'compra', c.id, c.created_at, c.valor, null, null, c.creada_por_nombre, u.nombre, c.proveedor, c.producto, c.facturas
        from public.recoleccion_compras c join public.usuarios u on u.id = c.recolector_id
        where (v_rec is null or c.recolector_id = v_rec) and c.created_at >= d and c.created_at < h
        union all
        select 'entrega', e.id, e.created_at, e.valor, e.nota, null, e.recibida_por_nombre, u.nombre, null, null, null
        from public.recoleccion_entregas e join public.usuarios u on u.id = e.recolector_id
        where (v_rec is null or e.recolector_id = v_rec) and e.created_at >= d and e.created_at < h
        order by 3 desc limit 500) m),
    'recolectores', case when v_admin then (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre), '[]')
                      from public.usuarios where activo and 'recolector' = any(roles)) else '[]'::jsonb end,
    -- Una tarjeta por recolector: lo del día y lo que debe tener ahora
    'por_recolector', case when v_admin and v_rec is null then (select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'nombre', u.nombre,
        'base', (select coalesce(sum(monto), 0) from public.recoleccion_bases where recolector_id = u.id and estado = 'aceptada' and created_at >= d and created_at < h),
        'compras', (select coalesce(sum(valor), 0) from public.recoleccion_compras where recolector_id = u.id and created_at >= d and created_at < h),
        'entregado', (select coalesce(sum(valor), 0) from public.recoleccion_entregas where recolector_id = u.id and created_at >= d and created_at < h),
        'pendientes', (select count(*) from public.recoleccion_bases where recolector_id = u.id and estado = 'pendiente'),
        'saldo', privado.recoleccion_saldo(u.id)) order by u.nombre), '[]')
      from public.usuarios u where u.activo and 'recolector' = any(u.roles)) else '[]'::jsonb end
  );
end $fn$;

revoke all on function public.recoleccion_recibir(bigint, numeric, text), public.recoleccion_borrar_entrega(bigint) from public, anon;
grant execute on function public.recoleccion_recibir(bigint, numeric, text), public.recoleccion_borrar_entrega(bigint) to authenticated;
