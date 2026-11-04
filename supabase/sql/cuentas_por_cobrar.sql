-- Cuentas por cobrar (YA APLICADO 2026-11-04)
-- Mercancía que se le entrega al costo a una persona de confianza (ej: el hermano del dueño) y lo
-- que esa persona va abonando. No es una venta: no entra a Ventas del local, caja, reportes ni
-- ganancias. Sí descuenta inventario y cuenta como vendido en Deudas (para apartar al proveedor).

create table if not exists public.cuentas_cobrar (
  id bigint generated always as identity primary key,
  nombre text not null check (length(trim(nombre)) between 2 and 80),
  telefono text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.cuenta_entregas (
  id bigint generated always as identity primary key,
  cuenta_id bigint not null references public.cuentas_cobrar(id),
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  total numeric not null check (total >= 0),
  nota text,
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
create table if not exists public.cuenta_entrega_items (
  id bigint generated always as identity primary key,
  entrega_id bigint not null references public.cuenta_entregas(id) on delete cascade,
  producto_id bigint not null references public.productos(id),
  nombre text not null,
  cantidad int not null check (cantidad > 0),
  costo numeric not null check (costo >= 0)
);
create table if not exists public.cuenta_abonos (
  id bigint generated always as identity primary key,
  cuenta_id bigint not null references public.cuentas_cobrar(id),
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  valor numeric not null check (valor > 0),
  metodo text not null default 'efectivo' check (metodo in ('efectivo', 'transferencia', 'otro')),
  comprobantes text[] not null default '{}',
  nota text,
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists cuenta_entregas_cuenta_idx on public.cuenta_entregas (cuenta_id);
create index if not exists cuenta_entrega_items_entrega_idx on public.cuenta_entrega_items (entrega_id);
create index if not exists cuenta_entrega_items_producto_idx on public.cuenta_entrega_items (producto_id);
create index if not exists cuenta_abonos_cuenta_idx on public.cuenta_abonos (cuenta_id);
alter table public.cuentas_cobrar enable row level security;
alter table public.cuenta_entregas enable row level security;
alter table public.cuenta_entrega_items enable row level security;
alter table public.cuenta_abonos enable row level security;
revoke all on public.cuentas_cobrar, public.cuenta_entregas, public.cuenta_entrega_items, public.cuenta_abonos from anon, authenticated;

create or replace function privado.solo_admin_cuentas() returns void language plpgsql stable security definer set search_path to '' as $$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin maneja las cuentas por cobrar'; end if;
end $$;
revoke execute on function privado.solo_admin_cuentas() from public, anon, authenticated;

create or replace function public.cuentas_lista()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  perform privado.solo_admin_cuentas();
  return coalesce((select jsonb_agg(x order by (x->>'saldo')::numeric desc, x->>'nombre') from (
    select jsonb_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono,
      'entregado', e.total, 'abonado', a.total, 'saldo', e.total - a.total,
      'ultima_entrega', e.ultima, 'ultimo_abono', a.ultima) x
    from public.cuentas_cobrar c
    cross join lateral (select coalesce(sum(total), 0) total, max(fecha) ultima from public.cuenta_entregas where cuenta_id = c.id) e
    cross join lateral (select coalesce(sum(valor), 0) total, max(fecha) ultima from public.cuenta_abonos where cuenta_id = c.id) a
    where c.activa) s), '[]');
end $function$;

create or replace function public.cuenta_detalle(p_cuenta bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  perform privado.solo_admin_cuentas();
  return (select jsonb_build_object('id', c.id, 'nombre', c.nombre, 'telefono', c.telefono,
    'entregas', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'fecha', e.fecha, 'total', e.total, 'nota', e.nota, 'quien', e.creado_por_nombre,
        'items', (select coalesce(jsonb_agg(jsonb_build_object('producto_id', i.producto_id, 'nombre', i.nombre, 'cantidad', i.cantidad, 'costo', i.costo) order by i.id), '[]')
                  from public.cuenta_entrega_items i where i.entrega_id = e.id)) order by e.fecha desc, e.id desc)
      from public.cuenta_entregas e where e.cuenta_id = c.id), '[]'),
    'abonos', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'fecha', a.fecha, 'valor', a.valor, 'metodo', a.metodo,
        'comprobantes', a.comprobantes, 'nota', a.nota, 'quien', a.creado_por_nombre) order by a.fecha desc, a.id desc)
      from public.cuenta_abonos a where a.cuenta_id = c.id), '[]'))
    from public.cuentas_cobrar c where c.id = p_cuenta);
end $function$;

create or replace function public.guardar_cuenta(p_cuenta bigint, p_nombre text, p_telefono text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_nombre text := privado.limpio(p_nombre, 80);
begin
  perform privado.solo_admin_cuentas();
  if v_nombre is null or length(v_nombre) < 2 then raise exception 'Escribe el nombre'; end if;
  if p_cuenta is null then
    insert into public.cuentas_cobrar (nombre, telefono) values (v_nombre, privado.limpio(p_telefono, 20)) returning id into v_id;
  else
    update public.cuentas_cobrar set nombre = v_nombre, telefono = privado.limpio(p_telefono, 20) where id = p_cuenta returning id into v_id;
    if v_id is null then raise exception 'Esa cuenta no existe'; end if;
  end if;
  return v_id;
end $function$;

-- Entregar mercancía al costo: descuenta inventario y suma a lo que debe
create or replace function public.entregar_al_costo(p_cuenta bigint, p_items jsonb, p_fecha date default null, p_nota text default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; it jsonb; pr public.productos; v_cant int; v_costo numeric; v_total numeric := 0;
begin
  perform privado.solo_admin_cuentas();
  if not exists (select 1 from public.cuentas_cobrar where id = p_cuenta and activa) then raise exception 'Esa cuenta no existe'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un producto'; end if;
  if p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'La fecha no puede ser después de hoy'; end if;
  insert into public.cuenta_entregas (cuenta_id, fecha, total, nota, creado_por_nombre)
  values (p_cuenta, coalesce(p_fecha, (now() at time zone 'America/Bogota')::date), 0, privado.limpio(p_nota, 300), public.mi_nombre())
  returning id into v_id;
  for it in select x from jsonb_array_elements(p_items) x loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint for update;
    if not found then raise exception 'Uno de los productos ya no existe'; end if;
    v_cant := coalesce((it->>'cantidad')::int, 0);
    if v_cant <= 0 then raise exception 'Revisa la cantidad de %', pr.nombre; end if;
    v_costo := round(coalesce((it->>'costo')::numeric, pr.precio_compra, 0));
    if v_costo < 0 then raise exception 'Revisa el costo de %', pr.nombre; end if;
    insert into public.cuenta_entrega_items (entrega_id, producto_id, nombre, cantidad, costo) values (v_id, pr.id, pr.nombre, v_cant, v_costo);
    if pr.controla_stock then update public.productos set stock = stock - v_cant, updated_at = now() where id = pr.id; end if;
    v_total := v_total + v_cant * v_costo;
  end loop;
  update public.cuenta_entregas set total = v_total where id = v_id;
  return v_id;
end $function$;

create or replace function public.abonar_cuenta(p_cuenta bigint, p_valor numeric, p_metodo text, p_comprobantes text[], p_nota text, p_fecha date default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_saldo numeric; v_valor numeric := round(coalesce(p_valor, 0));
begin
  perform privado.solo_admin_cuentas();
  if coalesce(p_metodo, '') not in ('efectivo', 'transferencia', 'otro') then raise exception 'Forma de pago inválida'; end if;
  if v_valor <= 0 then raise exception 'Escribe el valor del abono'; end if;
  if p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'La fecha no puede ser después de hoy'; end if;
  select coalesce((select sum(total) from public.cuenta_entregas where cuenta_id = p_cuenta), 0)
       - coalesce((select sum(valor) from public.cuenta_abonos where cuenta_id = p_cuenta), 0) into v_saldo;
  if v_valor > v_saldo then raise exception 'El abono es más de lo que debe (saldo %)', privado.pesos(v_saldo); end if;
  insert into public.cuenta_abonos (cuenta_id, fecha, valor, metodo, comprobantes, nota, creado_por_nombre)
  values (p_cuenta, coalesce(p_fecha, (now() at time zone 'America/Bogota')::date), v_valor, p_metodo, privado.comprobantes_validos(p_comprobantes),
          privado.limpio(p_nota, 300), public.mi_nombre());
end $function$;

-- Borrar una entrega subida por error: las unidades vuelven al inventario
create or replace function public.eliminar_entrega_costo(p_entrega bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  perform privado.solo_admin_cuentas();
  update public.productos pr set stock = pr.stock + i.cantidad, updated_at = now()
    from public.cuenta_entrega_items i where i.entrega_id = p_entrega and i.producto_id = pr.id and pr.controla_stock;
  delete from public.cuenta_entregas where id = p_entrega;
  if not found then raise exception 'Esa entrega no existe'; end if;
end $function$;

create or replace function public.eliminar_abono_cuenta(p_abono bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  perform privado.solo_admin_cuentas();
  delete from public.cuenta_abonos where id = p_abono;
  if not found then raise exception 'Ese abono no existe'; end if;
end $function$;

revoke execute on function public.cuentas_lista(), public.cuenta_detalle(bigint), public.guardar_cuenta(bigint, text, text),
  public.entregar_al_costo(bigint, jsonb, date, text), public.abonar_cuenta(bigint, numeric, text, text[], text, date),
  public.eliminar_entrega_costo(bigint), public.eliminar_abono_cuenta(bigint) from public, anon;
grant execute on function public.cuentas_lista(), public.cuenta_detalle(bigint), public.guardar_cuenta(bigint, text, text),
  public.entregar_al_costo(bigint, jsonb, date, text), public.abonar_cuenta(bigint, numeric, text, text[], text, date),
  public.eliminar_entrega_costo(bigint), public.eliminar_abono_cuenta(bigint) to authenticated;

-- Deudas: lo entregado al costo también cuenta como vendido
create or replace function privado.vendido_de_compra(p_compra bigint)
returns table(producto_id bigint, nombre text, cantidad int, costo numeric, vendidas int)
language sql stable security definer set search_path to '' as $$
  select i.producto_id, i.nombre, i.cantidad, i.costo,
    least(i.cantidad, greatest(coalesce((
      select sum(pi.cantidad) from public.pedido_items pi join public.pedidos p on p.id = pi.pedido_id
      where pi.producto_id = i.producto_id and p.estado = 'entregado' and p.entregado_at >= c.created_at), 0)
      + coalesce((select sum(ci.cantidad) from public.cuenta_entrega_items ci join public.cuenta_entregas ce on ce.id = ci.entrega_id
                  where ci.producto_id = i.producto_id and ce.created_at >= c.created_at), 0)
      - greatest(coalesce((select m.stock_antes from public.inventario_movimientos m
                           where m.compra_id = c.id and m.producto_id = i.producto_id and m.tipo = 'compra' order by m.id limit 1), 0), 0), 0))::int
  from public.compra_items i join public.compras c on c.id = i.compra_id
  where i.compra_id = p_compra
$$;

create or replace function privado.vendido_de_deuda(p_deuda bigint)
returns table(producto_id bigint, nombre text, cantidad int, costo numeric, vendidas int)
language plpgsql stable security definer set search_path to '' as $function$
declare d public.deudas; v_desde date;
begin
  select * into d from public.deudas where id = p_deuda;
  if not found then return; end if;
  v_desde := coalesce(d.contar_desde, case when d.compra_id is null then d.fecha end);
  if v_desde is null then
    return query select * from privado.vendido_de_compra(d.compra_id);
    return;
  end if;
  return query
    with it as (
      select i.producto_id, i.nombre, i.cantidad, i.costo from public.compra_items i where d.compra_id is not null and i.compra_id = d.compra_id
      union all
      select i.producto_id, i.nombre, i.cantidad, i.costo from public.deuda_items i where d.compra_id is null and i.deuda_id = d.id
    )
    select it.producto_id, it.nombre, it.cantidad, it.costo,
      least(it.cantidad, coalesce((
        select sum(pi.cantidad) from public.pedido_items pi join public.pedidos p on p.id = pi.pedido_id
        where pi.producto_id = it.producto_id and p.estado = 'entregado'
          and coalesce(p.entregado_at, p.created_at) >= (v_desde::timestamp at time zone 'America/Bogota')), 0)
      + coalesce((select sum(ci.cantidad) from public.cuenta_entrega_items ci join public.cuenta_entregas ce on ce.id = ci.entrega_id
                  where ci.producto_id = it.producto_id and ce.fecha >= v_desde), 0))::int
    from it;
end $function$;
revoke execute on function privado.vendido_de_compra(bigint), privado.vendido_de_deuda(bigint) from public, anon, authenticated;
