-- ============================================================================
--  Variedades JYB (proyecto Kaesuri) · Asignar pedidos con QR desde la app de Jasta
--  YA APLICADO en Supabase (proyecto Kaesuri); se guarda aquí como registro
--  porque lo usa la app de Jasta.
--
--  En la app de Jasta, quien despacha escanea los rótulos de los dos negocios.
--  Los de Variedades JYB (QR "KAESURI-…") llegan al puente jasta-puente
--  (acción "asignar"), que ya comprobó en Jasta que quien llama puede despachar
--  y trae el correo del mensajero. Aquí se busca el domiciliario con ese correo
--  y se aplica la misma regla del bot de Telegram (telegram_despachar).
--  La hora de asignación es la del escaneo (el disparador pedido_asignado_at),
--  así la ruta combinada de los dos negocios queda en el orden del escaneo.
--
--  Solo la llama el puente con la llave de servicio (se comprueba el rol del JWT).
-- ============================================================================

create or replace function public.jasta_asignar(p_email_dom text, p_numero bigint, p_desp text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare v_dom uuid; v_desp uuid; v_dom_nombre text; p public.pedidos; v_antes text; v_orden int; v_txt text; v_ok boolean := false;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'No autorizado';
  end if;
  v_dom := public.jasta_domiciliario(p_email_dom);
  if v_dom is null then
    return jsonb_build_object('ok', false, 'texto', 'Este mensajero no está como domiciliario en Variedades JYB (debe tener el mismo correo en las dos apps).');
  end if;
  -- Queda registrado a nombre de quien despacha si también tiene cuenta en Variedades JYB
  select id into v_desp from public.profiles
   where lower(email) = lower(trim(p_desp)) and coalesce(activo, true) and ('admin' = any(roles) or 'despachador' = any(roles));
  if v_desp is not null then
    perform set_config('request.jwt.claim.sub', v_desp::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_desp, 'role', 'authenticated')::text, true);
  end if;
  select nombre into v_dom_nombre from public.profiles where id = v_dom;

  select * into p from public.pedidos where numero = p_numero for update;
  if not found then v_txt := 'No encontré el pedido JYB #' || coalesce(p_numero::text, '?') || '.';
  elsif p.canal = 'local' then v_txt := 'El JYB #' || p.numero || ' es una venta del local.';
  elsif p.estado in ('entregado', 'cancelado') then v_txt := 'El pedido JYB #' || p.numero || ' ya está ' || p.estado::text || '.';
  elsif p.cuadre_id is not null then v_txt := 'El pedido JYB #' || p.numero || ' ya está en un cuadre.';
  elsif p.estado = 'en_ruta' and p.domiciliario_id = v_dom then
    v_txt := 'El JYB #' || p.numero || ' ya estaba en ruta con ' || v_dom_nombre || '.';
    return jsonb_build_object('ok', false, 'repetido', true, 'texto', v_txt);
  else
    v_antes := case when p.domiciliario_id is not null and p.domiciliario_id <> v_dom then (select nombre from public.profiles where id = p.domiciliario_id) end;
    update public.pedidos set estado = 'en_ruta', domiciliario_id = v_dom where id = p.id;
    select count(*) into v_orden from public.pedidos where estado = 'en_ruta' and domiciliario_id = v_dom;
    v_ok := true;
    v_txt := 'JYB #' || p.numero || ' → ' || v_dom_nombre || ' (' || v_orden || '.º en ruta de JYB) · ' || p.cliente_nombre || coalesce(', ' || p.barrio, '')
      || case when v_antes is not null then E'\n(se le quitó a ' || v_antes || ')' else '' end;
  end if;
  return jsonb_build_object('ok', v_ok, 'texto', v_txt);
end $function$;

-- Quitar un pedido de la ruta (se escaneó por error): vuelve a pendientes sin domiciliario
create or replace function public.jasta_quitar(p_email_dom text, p_numero bigint, p_desp text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare v_dom uuid; v_desp uuid; v_dom_nombre text; p public.pedidos;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'No autorizado';
  end if;
  v_dom := public.jasta_domiciliario(p_email_dom);
  if v_dom is null then
    return jsonb_build_object('ok', false, 'texto', 'Este mensajero no está como domiciliario en Variedades JYB.');
  end if;
  select id into v_desp from public.profiles
   where lower(email) = lower(trim(p_desp)) and coalesce(activo, true) and ('admin' = any(roles) or 'despachador' = any(roles));
  if v_desp is not null then
    perform set_config('request.jwt.claim.sub', v_desp::text, true);
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_desp, 'role', 'authenticated')::text, true);
  end if;
  select nombre into v_dom_nombre from public.profiles where id = v_dom;
  select * into p from public.pedidos where numero = p_numero for update;
  if not found then return jsonb_build_object('ok', false, 'texto', 'No encontré el pedido JYB #' || p_numero || '.'); end if;
  if p.estado <> 'en_ruta' or p.domiciliario_id is distinct from v_dom then
    return jsonb_build_object('ok', false, 'texto', 'El JYB #' || p.numero || ' ya no está en la ruta de este mensajero.');
  end if;
  update public.pedidos set estado = 'pendiente', domiciliario_id = null where id = p.id;
  return jsonb_build_object('ok', true, 'texto', 'Se quitó el JYB #' || p.numero || ' de la ruta de ' || coalesce(v_dom_nombre, '?') || '. Volvió a pendientes.');
end $function$;
