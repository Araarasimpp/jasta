-- Galería de colores: cada producto puede tener varios colores, cada uno con
-- su nombre, su tono y su propia foto (se sube al bucket "wp", carpeta colores/).
-- Lo ven todos los usuarios con sesión; solo admin los crea, cambia o quita.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
create table if not exists public.producto_colores (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) between 1 and 40),
  hex text check (hex is null or hex ~ '^#[0-9a-fA-F]{6}$'),
  imagen_url text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists producto_colores_producto_idx on public.producto_colores (producto_id, orden);
alter table public.producto_colores enable row level security;
create policy producto_colores_ver on public.producto_colores for select to authenticated using (true);
create policy producto_colores_admin on public.producto_colores for all to authenticated
  using ((select public.tiene_rol('admin'))) with check ((select public.tiene_rol('admin')));
