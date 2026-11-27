-- ============================================================================
--  Ordenar la ruta del mensajero arrastrando en Despachar
--  YA APLICADO en Supabase (Jasta y Variedades JYB); se guarda aquí como registro.
--
--  El orden de la ruta es la hora de asignación (asignado_at), en los dos negocios.
--  Al soltar, Despachar reparte de nuevo las mismas horas que ya tenía la ruta en el
--  orden nuevo y manda solo las que cambiaron. Mis entregas del mensajero ve que el
--  orden del servidor cambió y deja de usar el que había armado en su celular.
-- ============================================================================

-- ---------------------------------------------------------------- Jasta
create or replace function public.ordenar_ruta(p_mensajero bigint, p_items jsonb)
returns int language plpgsql security definer set search_path to '' as $function$
declare it jsonb; v_n int := 0;
begin
  if not exists (select 1 from public.usuarios u where u.auth_id = auth.uid() and u.activo and ('admin' = any(u.roles) or 'alistador' = any(u.roles))) then
    raise exception 'Solo quien despacha puede ordenar la ruta';
  end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.pedidos set asignado_at = (it->>'at')::timestamptz, updated_at = now()
     where id = (it->>'id')::bigint and mensajero_id = p_mensajero and estado = 'despachado';
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $function$;
revoke execute on function public.ordenar_ruta(bigint, jsonb) from public, anon;
grant execute on function public.ordenar_ruta(bigint, jsonb) to authenticated;

-- ---------------------------------------------------------------- Variedades JYB (Kaesuri)
-- La llama el puente jasta-puente (acción 'ordenar') con la llave de servicio, después de
-- comprobar en Jasta que quien llama puede despachar (despacho_correo_mensajero).
create or replace function public.jasta_ordenar(p_email_dom text, p_items jsonb)
returns int language plpgsql security definer set search_path to '' as $function$
declare v_dom uuid; it jsonb; v_n int := 0;
begin
  if coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'No autorizado';
  end if;
  v_dom := public.jasta_domiciliario(p_email_dom);
  if v_dom is null then return 0; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.pedidos set asignado_at = (it->>'at')::timestamptz
     where numero = (it->>'numero')::bigint and domiciliario_id = v_dom and estado = 'en_ruta';
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $function$;
