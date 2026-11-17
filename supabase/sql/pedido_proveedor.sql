-- YA APLICADO (2026-11-17). Queda aquí como registro.
-- Pedido al proveedor: proveedores con su WhatsApp, el proveedor de cada producto y la lista
-- de qué comprar agrupada por proveedor (incluye lo que bajó del mínimo aunque no se haya vendido).

create table if not exists public.proveedores (
  id bigint generated always as identity primary key,
  nombre text not null,
  telefono text,
  nota text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.proveedores enable row level security;
create unique index if not exists proveedores_nombre on public.proveedores (lower(nombre));
alter table public.productos add column if not exists proveedor_id bigint references public.proveedores(id) on delete set null;

-- Los nombres que ya aparecen en las compras quedan como proveedores (sin teléfono)
insert into public.proveedores (nombre)
select distinct on (lower(trim(proveedor))) trim(proveedor) from public.compras
where not anulada and length(trim(coalesce(proveedor, ''))) > 1
on conflict do nothing;

create or replace function privado.puede_bodega() returns boolean language sql stable security definer set search_path to ''
as $function$ select public.tiene_rol('admin') or public.tiene_rol('alistador') $function$;

create or replace function public.proveedores_lista()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not privado.puede_bodega() then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'telefono', p.telefono, 'nota', p.nota,
      'productos', (select count(*) from public.productos x where x.proveedor_id = p.id and x.activo)) order by lower(p.nombre)), '[]')
    from public.proveedores p where p.activo);
end $function$;

create or replace function public.guardar_proveedor(p_id bigint, p_nombre text, p_telefono text, p_nota text default null)
 returns bigint language plpgsql security definer set search_path to ''
as $function$
declare v_id bigint; v_tel text := nullif(regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g'), '');
begin
  if not privado.puede_bodega() then raise exception 'Sin permiso'; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe el nombre del proveedor'; end if;
  if v_tel is not null and length(v_tel) < 7 then raise exception 'Revisa el número de WhatsApp'; end if;
  if p_id is null then
    insert into public.proveedores (nombre, telefono, nota) values (left(trim(p_nombre), 80), v_tel, nullif(trim(coalesce(p_nota, '')), ''))
    on conflict (lower(nombre)) do update set telefono = coalesce(excluded.telefono, public.proveedores.telefono), activo = true
    returning id into v_id;
  else
    update public.proveedores set nombre = left(trim(p_nombre), 80), telefono = v_tel, nota = nullif(trim(coalesce(p_nota, '')), '')
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end $function$;

create or replace function public.ocultar_proveedor(p_id bigint)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not privado.puede_bodega() then raise exception 'Sin permiso'; end if;
  update public.proveedores set activo = false where id = p_id;
  update public.productos set proveedor_id = null where proveedor_id = p_id;
end $function$;

create or replace function public.producto_proveedor(p_producto bigint, p_proveedor bigint)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not privado.puede_bodega() then raise exception 'Sin permiso'; end if;
  update public.productos set proveedor_id = p_proveedor where id = p_producto;
end $function$;

-- Qué comprar, con el proveedor de cada producto (el que tiene asignado o al último que se le compró)
create or replace function public.compras_sugeridas2(p_dias integer default 21)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not privado.puede_bodega() then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.orden, x.vendidos_60 desc), '[]') from (
    with v as (
      select i.producto_id, sum(i.cantidad)::int n from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
      where p.estado <> 'cancelado' and p.created_at > now() - interval '60 days' group by 1
    ), s as (
      select p.id, p.nombre, p.sku, p.categoria, p.stock, coalesce(v.n, 0) n, p.stock_minimo, p.precio_compra, p.proveedor_id,
        greatest(ceil(coalesce(v.n, 0) / 60.0 * greatest(p_dias, 1))::int, coalesce(p.stock_minimo, 0)) objetivo
      from public.productos p left join v on v.producto_id = p.id
      where p.activo and p.controla_stock and (v.n > 0 or (p.stock_minimo is not null and p.stock <= p.stock_minimo))
    )
    select s.id, s.nombre, s.sku, s.categoria, s.stock, s.n vendidos_60,
      case when s.n > 0 then floor(greatest(s.stock, 0) / (s.n / 60.0))::int end dias,
      s.objetivo - greatest(s.stock, 0) sugerido, s.precio_compra costo, s.stock_minimo,
      (s.stock_minimo is not null and s.stock <= s.stock_minimo) bajo_minimo,
      coalesce(s.proveedor_id, (select pv.id from public.compra_items ci join public.compras c on c.id = ci.compra_id
          join public.proveedores pv on lower(pv.nombre) = lower(trim(c.proveedor)) and pv.activo
        where ci.producto_id = s.id and not c.anulada order by c.fecha desc, c.id desc limit 1)) proveedor_id,
      s.proveedor_id is not null proveedor_fijo,
      greatest(s.stock, 0) / greatest(s.n / 60.0, 0.0001) orden
    from s where s.objetivo - greatest(s.stock, 0) > 0
  ) x);
end $function$;

grant execute on function public.proveedores_lista(), public.guardar_proveedor(bigint, text, text, text), public.ocultar_proveedor(bigint),
  public.producto_proveedor(bigint, bigint), public.compras_sugeridas2(integer) to authenticated;
