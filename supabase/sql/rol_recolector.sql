-- Rol "recolector": recibe bases de dinero y registra compras durante el día.
--  · Base: el admin la envía (queda pendiente hasta que el recolector la acepta)
--    o el recolector la agrega él mismo (queda aceptada). Siempre lleva nombre
--    (de dónde viene). Varias al día: se van sumando.
--  · Compra: valor, proveedor, producto y foto de la factura (obligatoria,
--    bucket privado "comprobantes").
--  · Cuadre = bases aceptadas − compras.
-- Solo lo ven el recolector (lo suyo) y el admin (todo).
-- (alter type public.rol add value 'recolector' se corrió aparte, antes de esto.)
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

create table if not exists public.recoleccion_bases (
  id bigint generated always as identity primary key,
  recolector_id bigint not null references public.usuarios(id),
  monto numeric not null check (monto > 0 and monto <= 100000000),
  nombre text not null check (length(trim(nombre)) between 1 and 120),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  creada_por bigint references public.usuarios(id),
  creada_por_nombre text,
  respondida_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists recoleccion_bases_rec_idx on public.recoleccion_bases (recolector_id, created_at desc);

create table if not exists public.recoleccion_compras (
  id bigint generated always as identity primary key,
  recolector_id bigint not null references public.usuarios(id),
  valor numeric not null check (valor > 0 and valor <= 100000000),
  proveedor text not null check (length(trim(proveedor)) between 1 and 120),
  producto text not null check (length(trim(producto)) between 1 and 200),
  facturas text[] not null default '{}',
  creada_por_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists recoleccion_compras_rec_idx on public.recoleccion_compras (recolector_id, created_at desc);

alter table public.recoleccion_bases enable row level security;
alter table public.recoleccion_compras enable row level security;
create policy recoleccion_bases_ver on public.recoleccion_bases for select to authenticated
  using ((select public.tiene_rol('admin')) or recolector_id = (select public.mi_usuario_id()));
create policy recoleccion_compras_ver on public.recoleccion_compras for select to authenticated
  using ((select public.tiene_rol('admin')) or recolector_id = (select public.mi_usuario_id()));
grant select on public.recoleccion_bases, public.recoleccion_compras to authenticated;
alter publication supabase_realtime add table public.recoleccion_bases, public.recoleccion_compras;

-- El recolector también sube fotos (facturas) al bucket de comprobantes, en su carpeta
alter policy comprobantes_subir on storage.objects with check (
  bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text
  and ((select public.tiene_rol('admin')) or (select public.tiene_rol('mensajero')) or (select public.tiene_rol('venta_local'))
       or (select public.tiene_rol('recolector')))
);

-- ---------- Agregar base ----------
-- Admin: se la envía a un recolector (pendiente, le llega el aviso). Recolector: la suya, aceptada.
create or replace function public.recoleccion_agregar_base(p_monto numeric, p_nombre text, p_recolector bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_yo bigint := public.mi_usuario_id(); v_admin boolean := public.tiene_rol('admin'); v_rec bigint; v_id bigint;
begin
  if coalesce(p_monto, 0) <= 0 then raise exception 'Escribe el valor de la base'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Ponle nombre a la base (de dónde viene)'; end if;
  if public.tiene_rol('recolector') and (p_recolector is null or p_recolector = v_yo) then
    v_rec := v_yo;
  elsif v_admin then
    v_rec := p_recolector;
    if v_rec is null or not exists (select 1 from public.usuarios where id = v_rec and activo and 'recolector' = any(roles)) then
      raise exception 'Elige a qué recolector va la base';
    end if;
  else
    raise exception 'Sin permiso';
  end if;
  insert into public.recoleccion_bases (recolector_id, monto, nombre, estado, creada_por, creada_por_nombre, respondida_at)
  values (v_rec, p_monto, left(trim(p_nombre), 120), case when v_rec = v_yo then 'aceptada' else 'pendiente' end,
          v_yo, public.mi_nombre(), case when v_rec = v_yo then now() end)
  returning id into v_id;
  if v_rec <> v_yo then
    perform privado.avisar(array[v_rec], 'base_recolector', 'Te enviaron una base: $' || replace(to_char(p_monto, 'FM999G999G999'), ',', '.'),
      left(trim(p_nombre), 120) || ' · de ' || coalesce(public.mi_nombre(), 'admin') || '. Acéptala para sumarla.', '/app/recolector', null);
  end if;
  return v_id;
end $fn$;

-- ---------- Aceptar o rechazar una base enviada ----------
create or replace function public.recoleccion_responder_base(p_base bigint, p_aceptar boolean)
returns void language plpgsql security definer set search_path = '' as $fn$
declare b public.recoleccion_bases; v_yo bigint := public.mi_usuario_id();
begin
  select * into b from public.recoleccion_bases where id = p_base for update;
  if not found then raise exception 'Base no encontrada'; end if;
  if b.recolector_id <> v_yo then raise exception 'Esta base no es tuya'; end if;
  if b.estado <> 'pendiente' then raise exception 'Esta base ya fue %', b.estado; end if;
  update public.recoleccion_bases set estado = case when p_aceptar then 'aceptada' else 'rechazada' end, respondida_at = now() where id = p_base;
  if b.creada_por is not null then
    perform privado.avisar(array[b.creada_por], 'base_recolector',
      public.mi_nombre() || case when p_aceptar then ' aceptó la base' else ' rechazó la base' end || ' de $' || replace(to_char(b.monto, 'FM999G999G999'), ',', '.'),
      b.nombre, '/app/recolector', null);
  end if;
end $fn$;

-- ---------- Registrar compra ----------
create or replace function public.recoleccion_registrar_compra(p_valor numeric, p_proveedor text, p_producto text, p_facturas text[])
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_yo bigint := public.mi_usuario_id(); v_ev text[]; v_id bigint;
begin
  if not public.tiene_rol('recolector') then raise exception 'Solo el recolector registra compras'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Escribe el valor de la compra'; end if;
  if coalesce(trim(p_proveedor), '') = '' then raise exception 'Escribe el proveedor'; end if;
  if coalesce(trim(p_producto), '') = '' then raise exception 'Escribe qué compraste'; end if;
  v_ev := privado.comprobantes_validos(p_facturas);
  if cardinality(v_ev) = 0 then raise exception 'Sube la foto de la factura'; end if;
  insert into public.recoleccion_compras (recolector_id, valor, proveedor, producto, facturas, creada_por_nombre)
  values (v_yo, p_valor, left(trim(p_proveedor), 120), left(trim(p_producto), 200), v_ev, public.mi_nombre())
  returning id into v_id;
  return v_id;
end $fn$;

-- ---------- Resumen ----------
create or replace function public.recoleccion_resumen(p_desde date, p_hasta date, p_recolector bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_admin boolean := public.tiene_rol('admin');
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
        order by 3 desc limit 500) m),
    'recolectores', case when v_admin then (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre), '[]')
                      from public.usuarios where activo and 'recolector' = any(roles)) else '[]'::jsonb end
  );
end $fn$;

revoke all on function public.recoleccion_agregar_base(numeric, text, bigint) from public, anon;
revoke all on function public.recoleccion_responder_base(bigint, boolean) from public, anon;
revoke all on function public.recoleccion_registrar_compra(numeric, text, text, text[]) from public, anon;
revoke all on function public.recoleccion_resumen(date, date, bigint) from public, anon;
grant execute on function public.recoleccion_agregar_base(numeric, text, bigint) to authenticated;
grant execute on function public.recoleccion_responder_base(bigint, boolean) to authenticated;
grant execute on function public.recoleccion_registrar_compra(numeric, text, text, text[]) to authenticated;
grant execute on function public.recoleccion_resumen(date, date, bigint) to authenticated;

-- Cuando el recolector agrega su propia base, se les avisa a todos los admin
-- (se aplicó reemplazando el final de recoleccion_agregar_base):
--   else
--     perform privado.avisar(array(select id from public.usuarios where activo and 'admin' = any(roles)), 'base_recolector',
--       coalesce(public.mi_nombre(), 'El recolector') || ' agregó una base: $' || replace(to_char(p_monto, 'FM999G999G999'), ',', '.'),
--       left(trim(p_nombre), 120), '/app/recolector', null);
--   end if;
