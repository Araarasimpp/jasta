-- ============================================================================
--  Jasta · Despachar con QR desde la app (en vez de los bots de Telegram)
--  YA APLICADO en Supabase (proyecto Jasta); se guarda como registro.
--
--  Quien despacha (admin o alistamiento) elige el mensajero en la app y escanea
--  el QR del rótulo con la cámara. Mismas reglas que el bot de Telegram
--  (telegram_despachar): el pedido pasa a En ruta con ese mensajero y la hora
--  de asignación es la del escaneo, así la ruta queda en el orden del escaneo.
--
--  Los rótulos de Variedades JYB (QR "KAESURI-…") se asignan por el puente de
--  Variedades JYB (jasta-puente, acción "asignar"), que le pide aquí el correo
--  del mensajero con despacho_correo_mensajero (y así también comprueba que
--  quien llama puede despachar).
-- ============================================================================

create or replace function public.despachar_por_qr(p_mensajero bigint, p_pedido bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare v_desp_nombre text; v_mens_nombre text; p public.pedidos; v_antes text; v_orden int; v_txt text; v_ok boolean := false;
begin
  select u.nombre into v_desp_nombre from public.usuarios u
   where u.auth_id = auth.uid() and u.activo and ('admin' = any(u.roles) or 'alistador' = any(u.roles));
  if v_desp_nombre is null then raise exception 'Solo quien despacha puede asignar pedidos'; end if;
  select nombre into v_mens_nombre from public.usuarios where id = p_mensajero and activo and 'mensajero' = any(roles);
  if v_mens_nombre is null then raise exception 'Ese mensajero no existe o está inactivo'; end if;

  select * into p from public.pedidos where id = p_pedido for update;
  if not found then v_txt := 'No encontré el pedido #' || p_pedido || '.';
  elsif p.estado in ('entregado', 'cancelado') then v_txt := 'El pedido #' || p.id || ' ya está ' || lower(public.estado_label(p.estado)) || '.';
  elsif p.estado = 'despachado' and p.mensajero_id = p_mensajero then
    select count(*) into v_orden from public.pedidos
     where estado = 'despachado' and mensajero_id = p_mensajero and (coalesce(asignado_at, '-infinity'), id) <= (coalesce(p.asignado_at, '-infinity'), p.id);
    v_txt := 'El #' || p.id || ' ya estaba en ruta con ' || v_mens_nombre || '.';
    return jsonb_build_object('ok', false, 'repetido', true, 'texto', v_txt, 'orden', v_orden);
  else
    v_antes := case when p.estado = 'despachado' and p.mensajero_id is not null then (select nombre from public.usuarios where id = p.mensajero_id) end;
    update public.pedidos set estado = 'despachado', mensajero_id = p_mensajero, asignado_at = clock_timestamp(), updated_at = now() where id = p.id;
    insert into public.pedido_notas (pedido_id, autor, nota) values (p.id, v_desp_nombre,
      'Estado: ' || public.estado_label(p.estado) || ' → ' || public.estado_label('despachado') || ' (mensajero: ' || v_mens_nombre || ') · con QR desde la app'
      || case when v_antes is not null then ', antes lo tenía ' || v_antes else '' end);
    select count(*) into v_orden from public.pedidos where estado = 'despachado' and mensajero_id = p_mensajero;
    v_ok := true;
    v_txt := '#' || p.id || ' → ' || v_mens_nombre || ' (' || v_orden || '.º en ruta) · ' || p.cliente_nombre || coalesce(', ' || p.barrio, '')
      || case when v_antes is not null then E'\n(se le quitó a ' || v_antes || ')' else '' end;
  end if;
  return jsonb_build_object('ok', v_ok, 'texto', v_txt, 'orden', v_orden);
end $function$;

-- Correo del mensajero, para que el puente de Variedades JYB lo busque allá (solo quien despacha)
create or replace function public.despacho_correo_mensajero(p_mensajero bigint)
returns text
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare v_email text;
begin
  if not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo and ('admin' = any(u.roles) or 'alistador' = any(u.roles))) then
    raise exception 'Solo quien despacha puede asignar pedidos';
  end if;
  select email into v_email from public.usuarios where id = p_mensajero and activo and 'mensajero' = any(roles);
  if v_email is null then raise exception 'Ese mensajero no existe o está inactivo'; end if;
  return v_email;
end $function$;
