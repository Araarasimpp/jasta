-- PENDIENTE: córrelo en el SQL Editor de Supabase (o dile a Claude "dale").
-- Recolector: cada día cuadra por su cuenta.
--   Lo que el admin recibe queda a nombre del DÍA al que pertenece esa plata (no del día en que se registra).
--   Por día: base − compras − lo entregado de ese día = falta por entregar. No se arrastra nada de un día a otro.

alter table public.recoleccion_entregas add column if not exists dia date;
update public.recoleccion_entregas set dia = (created_at at time zone 'America/Bogota')::date where dia is null;
alter table public.recoleccion_entregas alter column dia set not null;
create index if not exists recoleccion_entregas_dia_idx on public.recoleccion_entregas (recolector_id, dia);

-- ---------- Datos: lo ya recibido, repartido en los días a los que pertenecía ----------
-- Julián: los $56.000 recibidos el 7 nov eran del 6 nov; y se quita la base de $56.000 "De ayer" que se puso para compensar.
update public.recoleccion_entregas set dia = '2026-11-06' where id = 3 and valor = 56000;
delete from public.recoleccion_bases where id = 64 and monto = 56000 and nombre = 'De ayer';
-- Andrés (entrega 1) y David (entrega 2) entregaron varios días juntos: una fila por día con lo de ese día.
do $$
declare e record; v_suma numeric;
begin
  for e in select * from public.recoleccion_entregas where id in (1, 2) loop
    create temp table _dias on commit drop as
      with b as (select (created_at at time zone 'America/Bogota')::date d, sum(monto) v from public.recoleccion_bases
                 where recolector_id = e.recolector_id and estado = 'aceptada' and created_at < e.created_at group by 1),
           c as (select (created_at at time zone 'America/Bogota')::date d, sum(valor) v from public.recoleccion_compras
                 where recolector_id = e.recolector_id and created_at < e.created_at group by 1),
           k as (select d from b union select d from c)
      select k.d, coalesce(b.v, 0) - coalesce(c.v, 0) neto from k left join b using (d) left join c using (d);
    select sum(neto) into v_suma from _dias where neto > 0;
    if v_suma = e.valor then
      insert into public.recoleccion_entregas (recolector_id, valor, nota, recibida_por, recibida_por_nombre, created_at, dia)
        select e.recolector_id, neto, e.nota, e.recibida_por, e.recibida_por_nombre, e.created_at, d from _dias where neto > 0;
      delete from public.recoleccion_entregas where id = e.id;
    else
      raise notice 'Entrega % no cuadra por días (% vs %): queda como está', e.id, v_suma, e.valor;
    end if;
    drop table _dias;
  end loop;
end $$;

-- ---------- Lo que falta por entregar de un día (o de un rango) ----------
create or replace function privado.recoleccion_pendiente(p_rec bigint, p_desde date, p_hasta date)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(monto) from public.recoleccion_bases where recolector_id = p_rec and estado = 'aceptada'
           and created_at >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz and created_at < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz), 0)
       - coalesce((select sum(valor) from public.recoleccion_compras where recolector_id = p_rec
           and created_at >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz and created_at < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz), 0)
       - coalesce((select sum(valor) from public.recoleccion_entregas where recolector_id = p_rec and dia between p_desde and p_hasta), 0)
$$;

-- ---------- Recibir: queda a nombre del día que se está cuadrando ----------
drop function if exists public.recoleccion_recibir(bigint, numeric, text);
create or replace function public.recoleccion_recibir(p_recolector bigint, p_valor numeric, p_nota text, p_dia date default null)
returns numeric language plpgsql security definer set search_path = '' as $$
declare v_valor numeric := round(coalesce(p_valor, 0)); v_dia date := coalesce(p_dia, (now() at time zone 'America/Bogota')::date); v_falta numeric;
  v_fecha text;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin recibe la plata del recolector'; end if;
  if not exists (select 1 from public.usuarios where id = p_recolector and 'recolector' = any(roles)) then raise exception 'Ese recolector no existe'; end if;
  if v_valor <= 0 then raise exception 'Escribe cuánto recibiste'; end if;
  if v_dia > (now() at time zone 'America/Bogota')::date then raise exception 'No puedes recibir plata de un día que no ha llegado'; end if;
  insert into public.recoleccion_entregas (recolector_id, valor, nota, recibida_por, recibida_por_nombre, dia)
  values (p_recolector, v_valor, nullif(left(trim(coalesce(p_nota, '')), 300), ''), public.mi_usuario_id(), public.mi_nombre(), v_dia);
  v_falta := privado.recoleccion_pendiente(p_recolector, v_dia, v_dia);
  v_fecha := to_char(v_dia, 'DD') || '/' || to_char(v_dia, 'MM');
  perform privado.avisar(array[p_recolector], 'base_recolector',
    coalesce(public.mi_nombre(), 'El admin') || ' recibió $' || replace(to_char(v_valor, 'FM999G999G999'), ',', '.') || ' del ' || v_fecha,
    case when v_falta = 0 then 'Ese día quedó en cero ✓' when v_falta > 0 then 'De ese día todavía faltan $' || replace(to_char(v_falta, 'FM999G999G999'), ',', '.')
         else 'De ese día quedó a tu favor $' || replace(to_char(-v_falta, 'FM999G999G999'), ',', '.') end, '/app/recolector', null);
  return v_falta;
end $$;
revoke all on function public.recoleccion_recibir(bigint, numeric, text, date) from public, anon;
grant execute on function public.recoleccion_recibir(bigint, numeric, text, date) to authenticated;

-- ---------- Resumen: todo por día; "saldo" ahora es lo que falta por entregar de ESTE día (o rango) ----------
create or replace function public.recoleccion_resumen(p_desde date, p_hasta date, p_recolector bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_admin boolean := public.tiene_rol('admin') or public.tiene_rol('cuadres');
  v_rec bigint;
  v_ini date := greatest(p_desde - 21, date '2026-11-04');
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
             where (v_rec is null or recolector_id = v_rec) and dia between p_desde and p_hasta),
    'saldo', case when v_rec is not null then privado.recoleccion_pendiente(v_rec, p_desde, p_hasta) end,
    'n_compras', (select count(*) from public.recoleccion_compras where (v_rec is null or recolector_id = v_rec) and created_at >= d and created_at < h),
    'n_bases', (select count(*) from public.recoleccion_bases where estado = 'aceptada' and (v_rec is null or recolector_id = v_rec) and created_at >= d and created_at < h),
    'pendientes', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'monto', b.monto, 'nombre', b.nombre, 'de', b.creada_por_nombre,
                     'recolector', u.nombre, 'fecha', b.created_at) order by b.created_at), '[]')
                   from public.recoleccion_bases b join public.usuarios u on u.id = b.recolector_id
                   where b.estado = 'pendiente' and (v_rec is null or b.recolector_id = v_rec)),
    'movimientos', (select coalesce(jsonb_agg(m order by m.fecha desc), '[]') from (
        select 'base' tipo, b.id, b.created_at fecha, b.monto valor, b.nombre, b.estado, b.creada_por_nombre quien, u.nombre recolector,
               null::text proveedor, null::text producto, null::text[] facturas, null::date dia
        from public.recoleccion_bases b join public.usuarios u on u.id = b.recolector_id
        where (v_rec is null or b.recolector_id = v_rec) and b.created_at >= d and b.created_at < h
        union all
        select 'compra', c.id, c.created_at, c.valor, null, null, c.creada_por_nombre, u.nombre, c.proveedor, c.producto, c.facturas, null
        from public.recoleccion_compras c join public.usuarios u on u.id = c.recolector_id
        where (v_rec is null or c.recolector_id = v_rec) and c.created_at >= d and c.created_at < h
        union all
        select 'entrega', e.id, e.created_at, e.valor, e.nota, null, e.recibida_por_nombre, u.nombre, null, null, null, e.dia
        from public.recoleccion_entregas e join public.usuarios u on u.id = e.recolector_id
        where (v_rec is null or e.recolector_id = v_rec) and e.dia between p_desde and p_hasta
        order by 3 desc limit 500) m),
    'recolectores', case when v_admin then (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre) order by nombre), '[]')
                      from public.usuarios where activo and 'recolector' = any(roles)) else '[]'::jsonb end,
    -- Una tarjeta por recolector con lo de este día
    'por_recolector', case when v_admin and v_rec is null then (select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'nombre', u.nombre,
        'base', (select coalesce(sum(monto), 0) from public.recoleccion_bases where recolector_id = u.id and estado = 'aceptada' and created_at >= d and created_at < h),
        'compras', (select coalesce(sum(valor), 0) from public.recoleccion_compras where recolector_id = u.id and created_at >= d and created_at < h),
        'entregado', (select coalesce(sum(valor), 0) from public.recoleccion_entregas where recolector_id = u.id and dia between p_desde and p_hasta),
        'pendientes', (select count(*) from public.recoleccion_bases where recolector_id = u.id and estado = 'pendiente'),
        'saldo', privado.recoleccion_pendiente(u.id, p_desde, p_hasta)) order by u.nombre), '[]')
      from public.usuarios u where u.activo and 'recolector' = any(u.roles)) else '[]'::jsonb end,
    -- Días anteriores (últimas 3 semanas) que quedaron sin entregar, para no perderlos de vista
    'dias_sin_entregar', (select coalesce(jsonb_agg(x order by x.dia desc, x.nombre), '[]') from (
        select u.id, u.nombre, dd.dia, privado.recoleccion_pendiente(u.id, dd.dia, dd.dia) falta
        from public.usuarios u
        cross join lateral (
          select (created_at at time zone 'America/Bogota')::date dia from public.recoleccion_bases where recolector_id = u.id and estado = 'aceptada' and created_at >= (v_ini::text || ' 00:00 America/Bogota')::timestamptz and created_at < d
          union select (created_at at time zone 'America/Bogota')::date from public.recoleccion_compras where recolector_id = u.id and created_at >= (v_ini::text || ' 00:00 America/Bogota')::timestamptz and created_at < d
        ) dd
        where 'recolector' = any(u.roles) and (v_rec is null or u.id = v_rec)
      ) x where x.falta > 0)
  );
end $$;
