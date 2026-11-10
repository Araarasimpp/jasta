-- YA APLICADO (2026-11-10). Queda aquí como registro.
-- Chat del pedido como WhatsApp: responder un mensaje, fotos y notas de voz.

alter table public.pedido_mensajes
  add column if not exists responde_a bigint,
  add column if not exists tipo text not null default 'texto',
  add column if not exists adjunto text,
  add column if not exists duracion int;

-- Fotos y notas de voz del chat: bucket privado, una carpeta por pedido
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 10485760,
  array['image/jpeg','image/png','image/webp','audio/mp4','audio/webm','audio/ogg','audio/mpeg','audio/aac','audio/x-m4a'])
on conflict (id) do nothing;

create or replace function public.chat_carpeta_ok(p_nombre text)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select case when split_part(p_nombre, '/', 1) ~ '^[0-9]{1,15}$'
    then public.participa_en_pedido(split_part(p_nombre, '/', 1)::bigint) else false end
$function$;
grant execute on function public.chat_carpeta_ok(text) to authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'chat_subir') then
    create policy chat_subir on storage.objects for insert to authenticated
      with check (bucket_id = 'chat' and (select public.chat_carpeta_ok(name)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'chat_ver') then
    create policy chat_ver on storage.objects for select to authenticated
      using (bucket_id = 'chat' and (select public.chat_carpeta_ok(name)));
  end if;
end $$;

-- Nueva función (la anterior, enviar_mensaje, sigue sirviendo a las apps sin actualizar)
create or replace function public.enviar_mensaje2(p_pedido bigint, p_texto text default '', p_responde bigint default null,
  p_tipo text default 'texto', p_adjunto text default null, p_duracion int default null)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  v_nombre text;
  p public.pedidos;
  v_id bigint;
  v_para bigint[];
  v_texto text := left(trim(coalesce(p_texto, '')), 1000);
  v_tipo text := coalesce(p_tipo, 'texto');
  v_aviso text;
begin
  if v_yo is null then raise exception 'Inicia sesión para escribir'; end if;
  if not public.participa_en_pedido(p_pedido) then raise exception 'No participas en este pedido'; end if;
  if v_tipo not in ('texto', 'foto', 'audio') then raise exception 'Mensaje no válido'; end if;
  if v_tipo = 'texto' then
    if p_adjunto is not null then raise exception 'Mensaje no válido'; end if;
    if length(v_texto) = 0 then raise exception 'Escribe un mensaje'; end if;
  else
    if p_adjunto is null or length(p_adjunto) > 300 or p_adjunto not like 'sb://chat/' || p_pedido || '/%' then
      raise exception 'Archivo no válido';
    end if;
  end if;
  if p_responde is not null and not exists (select 1 from public.pedido_mensajes where id = p_responde and pedido_id = p_pedido) then
    p_responde := null;
  end if;
  select * into p from public.pedidos where id = p_pedido;
  select nombre into v_nombre from public.usuarios where id = v_yo;
  insert into public.pedido_mensajes (pedido_id, autor_id, autor_nombre, texto, responde_a, tipo, adjunto, duracion)
  values (p_pedido, v_yo, coalesce(v_nombre, 'Alguien'), v_texto, p_responde, v_tipo, p_adjunto,
    case when v_tipo = 'audio' then least(greatest(coalesce(p_duracion, 0), 0), 3600) end)
  returning id into v_id;
  v_aviso := case v_tipo when 'foto' then '📷 Foto' || case when v_texto <> '' then ': ' || v_texto else '' end
    when 'audio' then '🎤 Nota de voz' else v_texto end;
  -- Le llega a la vendedora y al mensajero; mientras no sale a ruta, también a alistamiento
  v_para := array[p.vendedora_id, p.mensajero_id];
  if p.estado in ('por_alistar', 'alistado') then
    v_para := v_para || privado.con_rol(array['alistador']);
  end if;
  perform privado.avisar(v_para, 'mensaje', coalesce(v_nombre, 'Mensaje') || ' · pedido #' || p.id,
    left(v_aviso, 140), '/app/pedidos?id=' || p.id || '&chat=1', p.id);
  return v_id;
end $function$;
grant execute on function public.enviar_mensaje2(bigint, text, bigint, text, text, int) to authenticated;
