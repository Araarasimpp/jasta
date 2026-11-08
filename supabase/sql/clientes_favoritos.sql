-- YA APLICADO en Supabase (2026-11-08).
-- Favoritos del cliente (el corazón en cada producto de la tienda). Se desmarca con activo = false.
create table if not exists public.clientes_favoritos (
  cliente_id bigint not null references public.clientes_cuentas(id),
  producto_id bigint not null references public.productos(id),
  activo boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (cliente_id, producto_id)
);
alter table public.clientes_favoritos enable row level security;

create or replace function public.cliente_favorito(p_producto bigint, p_on boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cli bigint := (select id from public.clientes_cuentas where auth_id = auth.uid());
begin
  if v_cli is null then raise exception 'Inicia sesión para guardar favoritos'; end if;
  if not exists (select 1 from public.productos where id = p_producto) then raise exception 'Ese producto no existe'; end if;
  insert into public.clientes_favoritos (cliente_id, producto_id, activo, updated_at) values (v_cli, p_producto, coalesce(p_on, true), now())
  on conflict (cliente_id, producto_id) do update set activo = excluded.activo, updated_at = now();
  return coalesce((select jsonb_agg(producto_id order by updated_at desc) from public.clientes_favoritos where cliente_id = v_cli and activo), '[]');
end $$;

create or replace function public.cliente_favoritos()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'precio', p.precio_venta, 'imagen_url', p.imagen_url,
      'agotado', (p.controla_stock and coalesce(p.stock, 0) <= 0) or not p.activo) order by f.updated_at desc), '[]')
  from public.clientes_favoritos f
  join public.clientes_cuentas c on c.id = f.cliente_id and c.auth_id = auth.uid()
  join public.productos p on p.id = f.producto_id
  where f.activo
$$;
-- cliente_yo() también devuelve 'favoritos' (ids), ver clientes_tarjetas.sql + el reemplazo aplicado el mismo día.
