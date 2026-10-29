-- Cuentas para recibir transferencias (PENDIENTE DE APLICAR)
-- El admin las pone en Configuración (banco, titular, número y la foto del QR). El equipo las ve
-- para mostrarle el QR al cliente al entregar (Mis entregas) o en el local.
create table if not exists public.cuentas_pago (
  id bigint generated always as identity primary key,
  nombre text not null check (length(trim(nombre)) between 2 and 60),
  titular text,
  numero text,
  qr_url text,
  activa boolean not null default true,
  orden int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.cuentas_pago enable row level security;

drop policy if exists cuentas_pago_ver on public.cuentas_pago;
create policy cuentas_pago_ver on public.cuentas_pago for select to authenticated using (public.es_staff());
drop policy if exists cuentas_pago_admin on public.cuentas_pago;
create policy cuentas_pago_admin on public.cuentas_pago for all to authenticated
  using (public.tiene_rol('admin')) with check (public.tiene_rol('admin'));

revoke all on public.cuentas_pago from anon;
grant select, insert, update, delete on public.cuentas_pago to authenticated;
