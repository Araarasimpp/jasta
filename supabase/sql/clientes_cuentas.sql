-- YA APLICADO en Supabase (2026-11-08).
-- Cuentas de clientes de la tienda (parte 1): perfil, direcciones y pedidos unidos a la cuenta.
-- Los clientes NO son del equipo: no tienen fila en usuarios, así que es_staff()/tiene_rol() les dan falso
-- y no ven nada de adentro. Todo lo suyo pasa por las funciones cliente_* (solo su propia cuenta).

create table if not exists public.clientes_cuentas (
  id bigint generated always as identity primary key,
  auth_id uuid not null unique,
  nombre text not null default '',
  email text,
  prefijo text not null default '57',
  telefono text,
  tipo_doc text not null default 'CC',
  documento text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clientes_cuentas enable row level security;

create table if not exists public.clientes_direcciones (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes_cuentas(id),
  etiqueta text not null default 'Casa',
  direccion text not null,
  barrio text not null,
  indicaciones text,
  principal boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists clientes_direcciones_cliente_idx on public.clientes_direcciones (cliente_id) where activa;
alter table public.clientes_direcciones enable row level security;

-- Pedidos hechos con la cuenta iniciada
alter table public.pedidos add column if not exists cliente_cuenta_id bigint references public.clientes_cuentas(id);
create index if not exists pedidos_cliente_cuenta_idx on public.pedidos (cliente_cuenta_id) where cliente_cuenta_id is not null;

-- La tabla de conexiones (quién del equipo está en línea) ya no queda abierta a cualquiera con sesión
alter policy conexiones_ver on public.conexiones using ((select public.es_staff()));

-- ---------- Registro: equipo (correo autorizado) o cliente (registro desde la tienda / Google) ----------
create or replace function public.vincular_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- 1) Correo autorizado por el admin: es del equipo (como siempre)
  update public.usuarios set auth_id = new.id
   where lower(email) = lower(new.email) and auth_id is null and activo;
  if found then return new; end if;
  -- 2) Registro desde la tienda (o con Google): cuenta de cliente, sin ningún permiso de adentro
  if coalesce(new.raw_user_meta_data->>'tipo', '') = 'cliente' or coalesce(new.raw_app_meta_data->>'provider', 'email') not in ('email', 'phone') then
    insert into public.clientes_cuentas (auth_id, nombre, email, prefijo, telefono)
    values (new.id,
      left(trim(coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')), 80),
      lower(new.email),
      coalesce(nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'prefijo', ''), '\D', '', 'g'), ''), '57'),
      nullif(left(regexp_replace(coalesce(new.raw_user_meta_data->>'telefono', ''), '\D', '', 'g'), 14), ''))
    on conflict (auth_id) do nothing;
    return new;
  end if;
  raise exception 'CORREO_NO_AUTORIZADO' using errcode = 'P0001';
end $$;

-- El pedido de la tienda queda unido a la cuenta del cliente que lo hizo (si inició sesión)
create or replace function privado.pedido_cliente_cuenta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cliente_cuenta_id is null and auth.uid() is not null then
    new.cliente_cuenta_id := (select id from public.clientes_cuentas where auth_id = auth.uid());
  end if;
  return new;
end $$;
create or replace trigger pedido_cliente_cuenta before insert on public.pedidos for each row execute function privado.pedido_cliente_cuenta();

-- ---------- Funciones del cliente (solo su propia cuenta) ----------
create or replace function public.cliente_yo()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when c.id is null then null else jsonb_build_object(
    'id', c.id, 'nombre', c.nombre, 'email', c.email, 'prefijo', c.prefijo, 'telefono', c.telefono,
    'tipo_doc', c.tipo_doc, 'documento', c.documento, 'desde', c.created_at,
    'direcciones', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'etiqueta', d.etiqueta, 'direccion', d.direccion, 'barrio', d.barrio,
        'indicaciones', d.indicaciones, 'principal', d.principal) order by d.principal desc, d.created_at)
      from public.clientes_direcciones d where d.cliente_id = c.id and d.activa), '[]')
  ) end
  from (select 1) x left join public.clientes_cuentas c on c.auth_id = auth.uid()
$$;

create or replace function public.cliente_guardar(p_nombre text, p_prefijo text, p_telefono text, p_tipo_doc text, p_documento text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id bigint := (select id from public.clientes_cuentas where auth_id = auth.uid());
  v_tel text := nullif(left(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 14), '');
  v_pre text := coalesce(nullif(regexp_replace(coalesce(p_prefijo, ''), '\D', '', 'g'), ''), '57');
begin
  if v_id is null then raise exception 'Inicia sesión con tu cuenta de cliente'; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe tu nombre'; end if;
  if v_tel is null or (v_pre = '57' and length(v_tel) <> 10) then raise exception 'Escribe tu celular (10 números)'; end if;
  update public.clientes_cuentas set nombre = left(trim(p_nombre), 80), prefijo = v_pre, telefono = v_tel,
    tipo_doc = case when p_tipo_doc in ('CC', 'CE', 'NIT', 'PP', 'TI') then p_tipo_doc else 'CC' end,
    documento = nullif(left(regexp_replace(coalesce(p_documento, ''), '[^0-9A-Za-z-]', '', 'g'), 20), ''), updated_at = now()
  where id = v_id;
  return public.cliente_yo();
end $$;

create or replace function public.cliente_guardar_direccion(p_id bigint, p_etiqueta text, p_direccion text, p_barrio text, p_indicaciones text, p_principal boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cli bigint := (select id from public.clientes_cuentas where auth_id = auth.uid()); v_id bigint;
  v_primera boolean;
begin
  if v_cli is null then raise exception 'Inicia sesión con tu cuenta de cliente'; end if;
  if length(trim(coalesce(p_direccion, ''))) < 5 then raise exception 'Escribe la dirección completa'; end if;
  if length(trim(coalesce(p_barrio, ''))) < 3 then raise exception 'Elige el barrio (o tu ciudad si no eres de Cali)'; end if;
  v_primera := not exists (select 1 from public.clientes_direcciones where cliente_id = v_cli and activa and (p_id is null or id <> p_id));
  if p_id is null then
    if (select count(*) from public.clientes_direcciones where cliente_id = v_cli and activa) >= 10 then raise exception 'Puedes guardar hasta 10 direcciones'; end if;
    insert into public.clientes_direcciones (cliente_id, etiqueta, direccion, barrio, indicaciones, principal)
    values (v_cli, coalesce(nullif(left(trim(coalesce(p_etiqueta, '')), 30), ''), 'Casa'), left(trim(p_direccion), 200), left(trim(p_barrio), 80),
            nullif(left(trim(coalesce(p_indicaciones, '')), 200), ''), coalesce(p_principal, false) or v_primera)
    returning id into v_id;
  else
    update public.clientes_direcciones set etiqueta = coalesce(nullif(left(trim(coalesce(p_etiqueta, '')), 30), ''), 'Casa'),
      direccion = left(trim(p_direccion), 200), barrio = left(trim(p_barrio), 80), indicaciones = nullif(left(trim(coalesce(p_indicaciones, '')), 200), ''),
      principal = coalesce(p_principal, false) or v_primera
    where id = p_id and cliente_id = v_cli and activa returning id into v_id;
    if v_id is null then raise exception 'Esa dirección ya no existe'; end if;
  end if;
  -- Solo una principal
  if (select principal from public.clientes_direcciones where id = v_id) then
    update public.clientes_direcciones set principal = false where cliente_id = v_cli and id <> v_id and principal;
  end if;
  return public.cliente_yo();
end $$;

-- Quitar una dirección (queda guardada como inactiva) y, si era la principal, la siguiente pasa a serlo
create or replace function public.cliente_quitar_direccion(p_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cli bigint := (select id from public.clientes_cuentas where auth_id = auth.uid()); v_era boolean;
begin
  if v_cli is null then raise exception 'Inicia sesión con tu cuenta de cliente'; end if;
  update public.clientes_direcciones set activa = false, principal = false where id = p_id and cliente_id = v_cli and activa
    returning true into v_era;
  if v_era is null then raise exception 'Esa dirección ya no existe'; end if;
  if not exists (select 1 from public.clientes_direcciones where cliente_id = v_cli and activa and principal) then
    update public.clientes_direcciones set principal = true
    where id = (select id from public.clientes_direcciones where cliente_id = v_cli and activa order by created_at limit 1);
  end if;
  return public.cliente_yo();
end $$;

-- Barrios con su domicilio (para elegir el barrio al guardar una dirección en la cuenta)
create or replace function public.tienda_barrios()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('barrio', barrio, 'domicilio', domicilio) order by barrio), '[]')
  from public.tarifas_domicilio where activo
$$;

-- (Parte 2) El documento de facturación de la cuenta también queda en el pedido
create or replace function privado.pedido_cliente_cuenta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if new.cliente_cuenta_id is null and auth.uid() is not null then
    select id, documento into c from public.clientes_cuentas where auth_id = auth.uid();
    if found then
      new.cliente_cuenta_id := c.id;
      if new.destinatario_cedula is null and c.documento is not null then new.destinatario_cedula := c.documento; end if;
    end if;
  end if;
  return new;
end $$;

-- ===================== (Parte 3) Mis compras =====================
-- Los pedidos de la tienda se guardan primero en pedidos_web (por pagar / por confirmar): ahí queda la cuenta del
-- cliente, y cuando la vendedora lo confirma (pedido_id) la cuenta pasa también al pedido de verdad.
alter table public.pedidos_web add column if not exists cliente_cuenta_id bigint references public.clientes_cuentas(id);
create index if not exists pedidos_web_cliente_cuenta_idx on public.pedidos_web (cliente_cuenta_id) where cliente_cuenta_id is not null;

create or replace function privado.pedido_web_cliente_cuenta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cliente_cuenta_id is null and auth.uid() is not null then
    new.cliente_cuenta_id := (select id from public.clientes_cuentas where auth_id = auth.uid());
  end if;
  return new;
end $$;
create or replace trigger pedido_web_cliente_cuenta before insert on public.pedidos_web for each row execute function privado.pedido_web_cliente_cuenta();

create or replace function privado.pedido_web_confirmado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.pedido_id is not null and new.cliente_cuenta_id is not null and new.pedido_id is distinct from old.pedido_id then
    update public.pedidos p set cliente_cuenta_id = new.cliente_cuenta_id,
      destinatario_cedula = coalesce(p.destinatario_cedula, (select documento from public.clientes_cuentas where id = new.cliente_cuenta_id))
    where p.id = new.pedido_id and p.cliente_cuenta_id is null;
  end if;
  return null;
end $$;
create or replace trigger pedido_web_confirmado after update of pedido_id on public.pedidos_web for each row execute function privado.pedido_web_confirmado();

-- Sus compras: las de la tienda (con su cuenta) y las de antes hechas con su mismo correo ya verificado.
-- Solo datos para el cliente (nada de costos ni de ganancias).
create or replace function public.cliente_compras()
returns jsonb language sql stable security definer set search_path = '' as $$
  with yo as (
    select c.id, lower(c.email) email,
      coalesce((select u.email_confirmed_at is not null from auth.users u where u.id = c.auth_id), false) verificado
    from public.clientes_cuentas c where c.auth_id = auth.uid()
  ),
  web as (select pw.* from public.pedidos_web pw join yo on pw.cliente_cuenta_id = yo.id),
  ped as (
    select p.* from public.pedidos p, yo
    where p.cliente_cuenta_id = yo.id or (yo.verificado and yo.email is not null and lower(p.cliente_email) = yo.email)
  ),
  filas as (
    select pw.created_at fecha, pw.codigo::text codigo, 'pago' ruta, p.id pedido,
      case when p.id is not null then p.estado::text when pw.estado in ('cancelado', 'por_pagar') then pw.estado else 'por_confirmar' end estado,
      coalesce(p.total, pw.subtotal + coalesce(pw.valor_domicilio, 0) + coalesce(pw.recargo, 0)) total,
      coalesce(p.valor_domicilio, pw.valor_domicilio) domicilio,
      case when pw.estado <> 'cancelado' then pw.atendido_at end confirmado_at,
      p.alistado_at,
      case when p.estado in ('despachado', 'entregado') then coalesce(p.enviado_at, p.asignado_at, p.alistado_at) end enviado_at,
      p.entregado_at,
      coalesce(p.direccion, pw.direccion) direccion, coalesce(p.barrio, pw.barrio) barrio,
      pw.pago, pw.pago_estado, coalesce(p.canal, 'domicilio') canal,
      case when p.id is not null then
        (select jsonb_agg(jsonb_build_object('producto_id', i.producto_id, 'nombre', i.nombre, 'cantidad', i.cantidad, 'precio', i.precio_venta,
            'color', i.color, 'talla', i.talla, 'imagen_url', pr.imagen_url) order by i.id)
         from public.pedido_items i left join public.productos pr on pr.id = i.producto_id where i.pedido_id = p.id)
      else
        (select jsonb_agg(jsonb_build_object('producto_id', (x->>'producto_id')::bigint, 'nombre', x->>'nombre', 'cantidad', (x->>'cantidad')::int,
            'precio', (x->>'precio')::numeric, 'color', x->>'color', 'talla', x->>'talla', 'imagen_url', pr.imagen_url))
         from jsonb_array_elements(pw.items) x left join public.productos pr on pr.id = (x->>'producto_id')::bigint)
      end items
    from web pw left join public.pedidos p on p.id = pw.pedido_id
    union all
    select p.created_at, p.seguimiento::text, 'seguimiento', p.id, p.estado::text, p.total, p.valor_domicilio,
      p.created_at, p.alistado_at,
      case when p.estado in ('despachado', 'entregado') then coalesce(p.enviado_at, p.asignado_at, p.alistado_at) end,
      p.entregado_at, p.direccion, p.barrio, null, null, coalesce(p.canal, 'domicilio'),
      (select jsonb_agg(jsonb_build_object('producto_id', i.producto_id, 'nombre', i.nombre, 'cantidad', i.cantidad, 'precio', i.precio_venta,
          'color', i.color, 'talla', i.talla, 'imagen_url', pr.imagen_url) order by i.id)
       from public.pedido_items i left join public.productos pr on pr.id = i.producto_id where i.pedido_id = p.id)
    from ped p where not exists (select 1 from web w where w.pedido_id = p.id)
  )
  select coalesce(jsonb_agg(to_jsonb(f) order by f.fecha desc), '[]') from (select * from filas order by fecha desc limit 100) f
$$;

-- ===================== Foto de perfil del cliente (2026-11-09, YA APLICADO) =====================
alter table public.clientes_cuentas add column if not exists avatar_url text;
-- vincular_usuario() ahora guarda también la foto de Google (avatar_url / picture) al crear la cuenta de cliente.
-- cliente_yo() devuelve 'avatar_url'. Cambiar o quitar la foto (solo una subida a su propia carpeta de avatars):
create or replace function public.cliente_foto(p_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_cli bigint := (select id from public.clientes_cuentas where auth_id = auth.uid());
begin
  if v_cli is null then raise exception 'Inicia sesión con tu cuenta de cliente'; end if;
  if p_url is not null and p_url not like 'https://ktksdoedeazkvohewqzx.supabase.co/storage/v1/object/public/avatars/' || auth.uid()::text || '/%' then
    raise exception 'Foto inválida';
  end if;
  update public.clientes_cuentas set avatar_url = p_url, updated_at = now() where id = v_cli;
  return public.cliente_yo();
end $$;
