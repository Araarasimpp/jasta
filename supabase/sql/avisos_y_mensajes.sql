-- Avisos (como en Home ALS) y mensajes internos por pedido.
-- Ya aplicado en Supabase (por partes); se guarda aquí como respaldo.
-- La Edge Function está en supabase/functions/enviar-push.
--
--  * notificaciones: la campana de la app. Los avisos los crea la base con
--    triggers (pedido nuevo, despachado, entregado, cancelado, cuadre cerrado
--    y mensaje nuevo) y llegan al instante por Realtime.
--  * pedido_mensajes: conversación de cada pedido entre la vendedora, el
--    mensajero y alistamiento/admin. Se escribe con enviar_mensaje().
--  * push_suscripciones: celulares/computadores que reciben avisos con la app
--    cerrada. Cada aviso nuevo llama a la Edge Function enviar-push (pg_net).
--  * privado.push_config: claves VAPID y el secreto entre la base y la Edge
--    Function. Esquema privado: la app no lo puede leer.

create extension if not exists pg_net with schema extensions;

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Configuración privada del envío de avisos
-- ---------------------------------------------------------------------------
create table if not exists privado.push_config (
  id boolean primary key default true check (id),
  public_key text,
  private_key text,
  secreto text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
alter table privado.push_config enable row level security;
insert into privado.push_config (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------------
create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text,
  url text,
  pedido_id bigint references public.pedidos(id) on delete cascade,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notificaciones_usuario_idx on public.notificaciones (usuario_id, created_at desc);
create index if not exists notificaciones_pedido_idx on public.notificaciones (pedido_id) where pedido_id is not null;

alter table public.notificaciones enable row level security;
revoke all on public.notificaciones from anon, authenticated;
grant select, update (leida) on public.notificaciones to authenticated;

drop policy if exists notificaciones_ver on public.notificaciones;
create policy notificaciones_ver on public.notificaciones for select to authenticated
  using (usuario_id = (select public.mi_usuario_id()));
drop policy if exists notificaciones_leer on public.notificaciones;
create policy notificaciones_leer on public.notificaciones for update to authenticated
  using (usuario_id = (select public.mi_usuario_id()))
  with check (usuario_id = (select public.mi_usuario_id()));

-- Crea un aviso para cada persona de la lista (menos quien hizo la acción)
create or replace function privado.avisar(
  p_usuarios bigint[], p_tipo text, p_titulo text, p_cuerpo text, p_url text, p_pedido bigint default null
) returns void
language sql security definer set search_path to ''
as $$
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url, pedido_id)
  select distinct u.id, p_tipo, p_titulo, p_cuerpo,
    -- Quien solo es mensajero no entra a Pedidos: sus avisos lo llevan a Mis entregas
    case when p_url like '/app/pedidos%' and not (u.roles::text[] && array['admin','vendedora','alistador','cuadres'])
         then replace(p_url, '/app/pedidos', '/app/mis-entregas') else p_url end,
    p_pedido
  from public.usuarios u
  where u.id = any (p_usuarios) and u.activo
    and u.id is distinct from public.mi_usuario_id();
$$;
revoke all on function privado.avisar(bigint[], text, text, text, text, bigint) from public, anon, authenticated;

-- Personas con alguno de esos roles
create or replace function privado.con_rol(p_roles text[]) returns bigint[]
language sql stable security definer set search_path to ''
as $$ select coalesce(array_agg(id), '{}') from public.usuarios where activo and roles::text[] && p_roles $$;
revoke all on function privado.con_rol(text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Avisos automáticos de pedidos y cuadres
-- ---------------------------------------------------------------------------
create or replace function privado.avisos_pedido() returns trigger
language plpgsql security definer set search_path to ''
as $$
declare
  v_resumen text := new.cliente_nombre || coalesce(' · ' || nullif(trim(new.barrio), ''), '');
begin
  if tg_op = 'INSERT' then
    if coalesce(new.canal, 'domicilio') = 'domicilio' then
      perform privado.avisar(privado.con_rol(array['admin','alistador']), 'pedido_nuevo',
        'Pedido nuevo #' || new.id, v_resumen, '/app/pedidos?id=' || new.id, new.id);
    end if;
    return new;
  end if;

  -- Despachado (o cambio de mensajero estando en ruta): avisa al mensajero
  if new.estado = 'despachado' and new.mensajero_id is not null
     and (old.estado is distinct from 'despachado' or old.mensajero_id is distinct from new.mensajero_id) then
    perform privado.avisar(array[new.mensajero_id], 'pedido_asignado',
      'Tienes un pedido para entregar #' || new.id, v_resumen, '/app/mis-entregas', new.id);
  end if;

  if new.estado = 'entregado' and old.estado is distinct from 'entregado' and coalesce(new.canal, 'domicilio') = 'domicilio' then
    perform privado.avisar(array[new.vendedora_id], 'pedido_entregado',
      'Pedido entregado #' || new.id, v_resumen, '/app/pedidos?id=' || new.id, new.id);
  end if;

  if new.estado = 'cancelado' and old.estado is distinct from 'cancelado' then
    perform privado.avisar(array[new.vendedora_id, old.mensajero_id], 'pedido_cancelado',
      'Pedido cancelado #' || new.id, v_resumen, '/app/pedidos?id=' || new.id, new.id);
  end if;
  return new;
end $$;

drop trigger if exists trg_avisos_pedido on public.pedidos;
create trigger trg_avisos_pedido after insert or update of estado, mensajero_id on public.pedidos
  for each row execute function privado.avisos_pedido();

create or replace function privado.avisos_cuadre() returns trigger
language plpgsql security definer set search_path to ''
as $$
begin
  perform privado.avisar(array[new.mensajero_id], 'cuadre_confirmado',
    'Tu cuadre se cerró',
    new.cantidad_pedidos || ' pedidos · efectivo ' || to_char(new.total_efectivo - new.total_domicilios, 'FM$999G999G999'),
    '/app/cuadres', null);
  return new;
end $$;

drop trigger if exists trg_avisos_cuadre on public.cuadres;
create trigger trg_avisos_cuadre after insert on public.cuadres
  for each row execute function privado.avisos_cuadre();

-- ---------------------------------------------------------------------------
-- Mensajes internos por pedido
-- ---------------------------------------------------------------------------
create table if not exists public.pedido_mensajes (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos(id) on delete cascade,
  autor_id bigint references public.usuarios(id) on delete set null,
  autor_nombre text not null,
  texto text not null check (length(trim(texto)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists pedido_mensajes_pedido_idx on public.pedido_mensajes (pedido_id, created_at);

alter table public.pedido_mensajes enable row level security;
revoke all on public.pedido_mensajes from anon, authenticated;
grant select on public.pedido_mensajes to authenticated;

-- Ven la conversación: admin y alistamiento, la vendedora y el mensajero del pedido
create or replace function public.participa_en_pedido(p_pedido bigint) returns boolean
language sql stable security definer set search_path to ''
as $$
  select public.tiene_rol('admin') or public.tiene_rol('alistador') or exists (
    select 1 from public.pedidos p
    where p.id = p_pedido
      and (p.vendedora_id = public.mi_usuario_id() or p.mensajero_id = public.mi_usuario_id())
  )
$$;
revoke all on function public.participa_en_pedido(bigint) from public, anon;
grant execute on function public.participa_en_pedido(bigint) to authenticated;

drop policy if exists mensajes_ver on public.pedido_mensajes;
create policy mensajes_ver on public.pedido_mensajes for select to authenticated
  using ((select public.participa_en_pedido(pedido_id)));

create or replace function public.enviar_mensaje(p_pedido bigint, p_texto text) returns bigint
language plpgsql security definer set search_path to ''
as $$
declare
  v_yo bigint := public.mi_usuario_id();
  v_nombre text;
  p public.pedidos;
  v_id bigint;
  v_para bigint[];
begin
  if v_yo is null then raise exception 'Inicia sesión para escribir'; end if;
  if not public.participa_en_pedido(p_pedido) then raise exception 'No participas en este pedido'; end if;
  if length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'Escribe un mensaje'; end if;
  select * into p from public.pedidos where id = p_pedido;
  select nombre into v_nombre from public.usuarios where id = v_yo;

  insert into public.pedido_mensajes (pedido_id, autor_id, autor_nombre, texto)
  values (p_pedido, v_yo, coalesce(v_nombre, 'Alguien'), left(trim(p_texto), 1000))
  returning id into v_id;

  -- Le llega a la vendedora y al mensajero; mientras no sale a ruta, también a alistamiento
  v_para := array[p.vendedora_id, p.mensajero_id];
  if p.estado in ('por_alistar', 'alistado') then
    v_para := v_para || privado.con_rol(array['alistador']);
  end if;
  perform privado.avisar(v_para, 'mensaje',
    coalesce(v_nombre, 'Mensaje') || ' · pedido #' || p.id, left(trim(p_texto), 140),
    '/app/pedidos?id=' || p.id || '&chat=1', p.id);
  return v_id;
end $$;
revoke all on function public.enviar_mensaje(bigint, text) from public, anon;
grant execute on function public.enviar_mensaje(bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Avisos con la app cerrada (Web Push)
-- ---------------------------------------------------------------------------
create table if not exists public.push_suscripciones (
  id bigint generated always as identity primary key,
  usuario_id bigint not null references public.usuarios(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  created_at timestamptz not null default now()
);
alter table public.push_suscripciones enable row level security;
revoke all on public.push_suscripciones from anon, authenticated;

create or replace function public.registrar_push(p_endpoint text, p_p256dh text, p_auth text, p_dispositivo text default null)
returns void language plpgsql security definer set search_path to ''
as $$
declare v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null then raise exception 'Inicia sesión'; end if;
  insert into public.push_suscripciones (usuario_id, endpoint, p256dh, auth, dispositivo)
  values (v_yo, p_endpoint, p_p256dh, p_auth, left(p_dispositivo, 200))
  on conflict (endpoint) do update
    set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth,
        dispositivo = excluded.dispositivo, created_at = now();
end $$;
revoke all on function public.registrar_push(text, text, text, text) from public, anon;
grant execute on function public.registrar_push(text, text, text, text) to authenticated;

create or replace function public.quitar_push(p_endpoint text) returns void
language sql security definer set search_path to ''
as $$ delete from public.push_suscripciones where endpoint = p_endpoint and usuario_id = public.mi_usuario_id() $$;
revoke all on function public.quitar_push(text) from public, anon;
grant execute on function public.quitar_push(text) to authenticated;

-- Cada aviso nuevo se manda a los celulares de esa persona (Edge Function enviar-push)
create or replace function privado.enviar_push() returns trigger
language plpgsql security definer set search_path to ''
as $$
declare v_secreto text;
begin
  if not exists (select 1 from public.push_suscripciones where usuario_id = new.usuario_id) then return new; end if;
  select secreto into v_secreto from privado.push_config where id;
  perform net.http_post(
    url := 'https://ktksdoedeazkvohewqzx.supabase.co/functions/v1/enviar-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secreto', v_secreto),
    body := jsonb_build_object('id', new.id)
  );
  return new;
end $$;

drop trigger if exists trg_enviar_push on public.notificaciones;
create trigger trg_enviar_push after insert on public.notificaciones
  for each row execute function privado.enviar_push();

-- Realtime: avisos y mensajes llegan al instante a la app abierta
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notificaciones') then
    alter publication supabase_realtime add table public.notificaciones;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'pedido_mensajes') then
    alter publication supabase_realtime add table public.pedido_mensajes;
  end if;
end $$;
