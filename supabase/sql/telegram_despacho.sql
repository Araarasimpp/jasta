-- Despacho por Telegram
-- Cada mensajero tiene un grupo de Telegram (él, quien despacha y el bot de
-- Jasta). Quien despacha manda la foto del rótulo al grupo; el bot lee el QR
-- del rótulo y le asigna el pedido al mensajero de ese grupo (queda En ruta),
-- en el orden en que llegan las fotos.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

-- Configuración del bot (solo lo ve el servidor)
create table if not exists privado.telegram_config (
  id boolean primary key default true check (id),
  token text not null,
  secreto text not null,
  bot_usuario text,
  actualizado timestamptz not null default now()
);

-- Grupo de Telegram ↔ mensajero (el grupo de cada domiciliario)
create table if not exists public.telegram_grupos (
  chat_id bigint primary key,
  mensajero_id bigint not null references public.usuarios(id) on delete cascade,
  titulo text,
  vinculado_por bigint references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.telegram_grupos enable row level security;
create policy telegram_grupos_ver on public.telegram_grupos for select to authenticated
  using ((select public.tiene_rol('admin')) or (select public.tiene_rol('alistador')));

-- Cuenta de Telegram ↔ usuario de Jasta (quién despacha)
create table if not exists public.telegram_usuarios (
  telegram_id bigint primary key,
  usuario_id bigint not null unique references public.usuarios(id) on delete cascade,
  nombre_tg text,
  created_at timestamptz not null default now()
);
alter table public.telegram_usuarios enable row level security;
create policy telegram_usuarios_ver on public.telegram_usuarios for select to authenticated
  using (usuario_id = (select public.mi_usuario_id()) or (select public.tiene_rol('admin')));

-- Códigos de un solo uso para vincular (vencen en 30 minutos)
create table if not exists privado.telegram_codigos (
  codigo text primary key,
  tipo text not null check (tipo in ('usuario', 'grupo')),
  usuario_id bigint references public.usuarios(id) on delete cascade,
  mensajero_id bigint references public.usuarios(id) on delete cascade,
  creado_por bigint references public.usuarios(id) on delete set null,
  expira_at timestamptz not null default now() + interval '30 minutes',
  usado_at timestamptz
);

-- Cada foto se procesa una sola vez (Telegram reintenta si tardamos)
create table if not exists privado.telegram_mensajes (
  chat_id bigint not null,
  message_id bigint not null,
  pedido_id bigint,
  resultado text,
  created_at timestamptz not null default now(),
  primary key (chat_id, message_id)
);

-- ---------- Para la app ----------
create or replace function public.telegram_estado()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select jsonb_build_object(
    'conectado', exists (select 1 from privado.telegram_config),
    'bot', (select bot_usuario from privado.telegram_config),
    'vinculado', exists (select 1 from public.telegram_usuarios where usuario_id = public.mi_usuario_id()),
    'grupos', case when public.tiene_rol('admin') or public.tiene_rol('alistador') then coalesce((
      select jsonb_agg(jsonb_build_object('chat_id', g.chat_id, 'titulo', g.titulo, 'mensajero_id', g.mensajero_id, 'mensajero', u.nombre) order by u.nombre)
      from public.telegram_grupos g join public.usuarios u on u.id = g.mensajero_id), '[]'::jsonb) else '[]'::jsonb end,
    'despachadores', case when public.tiene_rol('admin') then coalesce((
      select jsonb_agg(jsonb_build_object('usuario', u.nombre, 'telegram', t.nombre_tg) order by u.nombre)
      from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id), '[]'::jsonb) else '[]'::jsonb end
  )
$fn$;

create or replace function public.telegram_codigo(p_tipo text, p_mensajero bigint default null)
returns text language plpgsql volatile security definer set search_path = '' as $fn$
declare v_yo bigint := public.mi_usuario_id(); v_codigo text;
begin
  if v_yo is null then raise exception 'Sin sesión'; end if;
  if not (public.tiene_rol('admin') or public.tiene_rol('alistador')) then raise exception 'Solo quien despacha usa Telegram'; end if;
  if p_tipo = 'grupo' then
    if not exists (select 1 from public.usuarios where id = p_mensajero and 'mensajero' = any(roles)) then raise exception 'Elige un mensajero'; end if;
  elsif p_tipo <> 'usuario' then
    raise exception 'Tipo inválido';
  end if;
  v_codigo := upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
  insert into privado.telegram_codigos (codigo, tipo, usuario_id, mensajero_id, creado_por)
  values (v_codigo, p_tipo, case when p_tipo = 'usuario' then v_yo end, case when p_tipo = 'grupo' then p_mensajero end, v_yo);
  return v_codigo;
end $fn$;

create or replace function public.telegram_puede_configurar()
returns boolean language sql stable security definer set search_path = '' as $fn$ select public.tiene_rol('admin') $fn$;

-- ---------- Solo para el bot (service_role) ----------
create or replace function public.telegram_config_leer()
returns jsonb language sql stable security definer set search_path = '' as $fn$
  select to_jsonb(c) from privado.telegram_config c
$fn$;

create or replace function public.telegram_config_guardar(p_token text, p_secreto text, p_bot text)
returns void language sql volatile security definer set search_path = '' as $fn$
  insert into privado.telegram_config (id, token, secreto, bot_usuario, actualizado) values (true, p_token, p_secreto, p_bot, now())
  on conflict (id) do update set token = excluded.token, secreto = excluded.secreto, bot_usuario = excluded.bot_usuario, actualizado = now()
$fn$;

-- Usa un código: vincula la cuenta de Telegram (chat privado) o el grupo
create or replace function public.telegram_vincular(p_codigo text, p_telegram_id bigint, p_nombre text, p_chat_id bigint, p_titulo text, p_es_grupo boolean)
returns text language plpgsql volatile security definer set search_path = '' as $fn$
declare c privado.telegram_codigos; v_nombre text;
begin
  select * into c from privado.telegram_codigos where codigo = upper(trim(p_codigo)) for update;
  if not found or c.usado_at is not null or c.expira_at < now() then
    return '❌ Ese código no sirve o ya venció. Pide uno nuevo en la app.';
  end if;
  if c.tipo = 'usuario' then
    if p_es_grupo then return 'Este código es para tu cuenta: escríbemelo por chat privado, no en el grupo.'; end if;
    -- Una cuenta de Telegram por usuario de Jasta (si ya tenía otra, se cambia)
    update public.telegram_usuarios set telegram_id = p_telegram_id, nombre_tg = p_nombre where usuario_id = c.usuario_id;
    if not found then
      insert into public.telegram_usuarios (telegram_id, usuario_id, nombre_tg) values (p_telegram_id, c.usuario_id, p_nombre)
      on conflict (telegram_id) do update set usuario_id = excluded.usuario_id, nombre_tg = excluded.nombre_tg;
    end if;
    select nombre into v_nombre from public.usuarios where id = c.usuario_id;
    update privado.telegram_codigos set usado_at = now() where codigo = c.codigo;
    return '✅ Listo, ' || v_nombre || '. Ya puedes despachar mandando la foto del rótulo al grupo de cada mensajero.';
  end if;
  if not p_es_grupo then
    return 'Este código es para un grupo: escríbelo dentro del grupo del mensajero.';
  end if;
  insert into public.telegram_grupos (chat_id, mensajero_id, titulo, vinculado_por) values (p_chat_id, c.mensajero_id, p_titulo, c.creado_por)
  on conflict (chat_id) do update set mensajero_id = excluded.mensajero_id, titulo = excluded.titulo, vinculado_por = excluded.vinculado_por;
  select nombre into v_nombre from public.usuarios where id = c.mensajero_id;
  update privado.telegram_codigos set usado_at = now() where codigo = c.codigo;
  return '✅ Este grupo quedó vinculado a ' || v_nombre || '. Cada foto de rótulo que manden aquí se le asigna, en el orden en que lleguen.';
end $fn$;

-- Despacha un pedido al mensajero del grupo. Devuelve el texto para responder en el grupo
create or replace function public.telegram_despachar(p_chat_id bigint, p_message_id bigint, p_telegram_id bigint, p_pedido bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $fn$
declare g public.telegram_grupos; v_desp bigint; v_desp_nombre text; v_mens_nombre text; p public.pedidos; v_antes text; v_orden int; v_txt text;
begin
  -- Ya procesado (reintento de Telegram): no se repite
  if exists (select 1 from privado.telegram_mensajes where chat_id = p_chat_id and message_id = p_message_id) then
    return jsonb_build_object('ok', true, 'repetido', true);
  end if;
  select * into g from public.telegram_grupos where chat_id = p_chat_id;
  if not found then
    return jsonb_build_object('ok', false, 'texto', 'Este grupo no está vinculado a ningún mensajero. Vincúlalo desde la app (Configuración → Telegram).');
  end if;
  -- Solo quien despacha (admin o alistamiento, con su Telegram vinculado)
  select t.usuario_id, u.nombre into v_desp, v_desp_nombre from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id
   where t.telegram_id = p_telegram_id and u.activo and ('admin' = any(u.roles) or 'alistador' = any(u.roles));
  if v_desp is null then return jsonb_build_object('ok', false, 'silencio', true); end if;
  select nombre into v_mens_nombre from public.usuarios where id = g.mensajero_id;

  select * into p from public.pedidos where id = p_pedido for update;
  if not found then v_txt := '❌ No encontré el pedido #' || p_pedido || '.';
  elsif p.estado in ('entregado', 'cancelado') then v_txt := '❌ El pedido #' || p.id || ' ya está ' || lower(public.estado_label(p.estado)) || '.';
  elsif p.estado = 'despachado' and p.mensajero_id = g.mensajero_id then v_txt := 'ℹ️ El #' || p.id || ' ya estaba en ruta con ' || v_mens_nombre || '.';
  else
    v_antes := case when p.estado = 'despachado' and p.mensajero_id is not null then (select nombre from public.usuarios where id = p.mensajero_id) end;
    update public.pedidos set estado = 'despachado', mensajero_id = g.mensajero_id, asignado_at = now(), updated_at = now() where id = p.id;
    insert into public.pedido_notas (pedido_id, autor, nota) values (p.id, v_desp_nombre,
      'Estado: ' || public.estado_label(p.estado) || ' → ' || public.estado_label('despachado') || ' (mensajero: ' || v_mens_nombre || ') · por Telegram'
      || case when v_antes is not null then ', antes lo tenía ' || v_antes else '' end);
    select count(*) into v_orden from public.pedidos where estado = 'despachado' and mensajero_id = g.mensajero_id;
    v_txt := '✅ #' || p.id || ' → ' || v_mens_nombre || ' (' || v_orden || '.º en ruta) · ' || p.cliente_nombre || coalesce(', ' || p.barrio, '')
      || case when v_antes is not null then E'\n(se le quitó a ' || v_antes || ')' else '' end;
  end if;
  insert into privado.telegram_mensajes (chat_id, message_id, pedido_id, resultado) values (p_chat_id, p_message_id, p_pedido, v_txt);
  return jsonb_build_object('ok', v_txt like '✅%', 'texto', v_txt);
end $fn$;

-- La ruta del mensajero del grupo, en el orden en que se le asignaron
create or replace function public.telegram_ruta(p_chat_id bigint)
returns text language sql stable security definer set search_path = '' as $fn$
  select coalesce(
    (select max(r.mensajero) || E' tiene en ruta:\n' || string_agg(r.n || '. #' || r.pedido || ' · ' || r.cliente || coalesce(' (' || r.barrio || ')', ''), E'\n' order by r.n)
     from (select p.id as pedido, p.cliente_nombre as cliente, p.barrio, u.nombre as mensajero,
                  row_number() over (order by p.asignado_at nulls first, p.id) as n
           from public.pedidos p
           join public.telegram_grupos g on g.mensajero_id = p.mensajero_id
           join public.usuarios u on u.id = p.mensajero_id
           where g.chat_id = p_chat_id and p.estado = 'despachado') r
     having count(*) > 0),
    'No tiene pedidos en ruta.')
$fn$;

revoke all on function public.telegram_config_leer() from public, anon, authenticated;
revoke all on function public.telegram_config_guardar(text, text, text) from public, anon, authenticated;
revoke all on function public.telegram_vincular(text, bigint, text, bigint, text, boolean) from public, anon, authenticated;
revoke all on function public.telegram_despachar(bigint, bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.telegram_ruta(bigint) from public, anon, authenticated;
grant execute on function public.telegram_config_leer() to service_role;
grant execute on function public.telegram_config_guardar(text, text, text) to service_role;
grant execute on function public.telegram_vincular(text, bigint, text, bigint, text, boolean) to service_role;
grant execute on function public.telegram_despachar(bigint, bigint, bigint, bigint) to service_role;
grant execute on function public.telegram_ruta(bigint) to service_role;
revoke all on function public.telegram_estado() from public, anon;
revoke all on function public.telegram_codigo(text, bigint) from public, anon;
revoke all on function public.telegram_puede_configurar() from public, anon;
grant execute on function public.telegram_estado() to authenticated;
grant execute on function public.telegram_codigo(text, bigint) to authenticated;
grant execute on function public.telegram_puede_configurar() to authenticated;
