-- YA APLICADO en Supabase (2026-11-08).
-- Tarjetas guardadas del cliente (como en las tiendas en línea): Wompi guarda la tarjeta ("fuente de pago");
-- aquí solo queda la referencia de Wompi, la marca, los últimos 4 números y el vencimiento. Nunca el número ni el CVC.
create table if not exists public.clientes_tarjetas (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes_cuentas(id),
  wompi_fuente bigint not null,
  marca text,
  ultimos4 text,
  titular text,
  exp_mes text,
  exp_anio text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists clientes_tarjetas_cliente_idx on public.clientes_tarjetas (cliente_id) where activa;
alter table public.clientes_tarjetas enable row level security;

-- Mi cuenta: ahora también trae las tarjetas guardadas
create or replace function public.cliente_yo()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when c.id is null then null else jsonb_build_object(
    'id', c.id, 'nombre', c.nombre, 'email', c.email, 'prefijo', c.prefijo, 'telefono', c.telefono,
    'tipo_doc', c.tipo_doc, 'documento', c.documento, 'desde', c.created_at,
    'direcciones', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'etiqueta', d.etiqueta, 'direccion', d.direccion, 'barrio', d.barrio,
        'indicaciones', d.indicaciones, 'principal', d.principal) order by d.principal desc, d.created_at)
      from public.clientes_direcciones d where d.cliente_id = c.id and d.activa), '[]'),
    'tarjetas', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'marca', t.marca, 'ultimos4', t.ultimos4, 'exp_mes', t.exp_mes, 'exp_anio', t.exp_anio) order by t.created_at desc)
      from public.clientes_tarjetas t where t.cliente_id = c.id and t.activa), '[]')
  ) end
  from (select 1) x left join public.clientes_cuentas c on c.auth_id = auth.uid()
$$;

create or replace function public.cliente_quitar_tarjeta(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cli bigint := (select id from public.clientes_cuentas where auth_id = auth.uid()); v_ok boolean;
begin
  if v_cli is null then raise exception 'Inicia sesión con tu cuenta de cliente'; end if;
  update public.clientes_tarjetas set activa = false where id = p_id and cliente_id = v_cli and activa returning true into v_ok;
  if v_ok is null then raise exception 'Esa tarjeta ya no está guardada'; end if;
  return public.cliente_yo();
end $$;
