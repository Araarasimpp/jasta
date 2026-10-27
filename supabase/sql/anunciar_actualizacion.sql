-- Avisar una actualización de la app al equipo (YA APLICADO)
-- Lo usa Configuración → "Avisar una actualización". Llega como notificación
-- (campana + push). Sin roles, le llega a todos los usuarios activos.
create or replace function public.anunciar_actualizacion(p_titulo text, p_cuerpo text, p_roles text[])
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_ids bigint[];
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede avisar actualizaciones'; end if;
  if nullif(trim(coalesce(p_titulo, '')), '') is null then raise exception 'Escribe el título'; end if;
  v_ids := case when coalesce(cardinality(p_roles), 0) = 0
                then (select coalesce(array_agg(id), '{}') from public.usuarios where activo)
                else privado.con_rol(p_roles) end;
  perform privado.avisar(v_ids, 'actualizacion', left(trim(p_titulo), 120), left(trim(coalesce(p_cuerpo, '')), 500), null, null);
  return (select count(*) from public.usuarios where id = any (v_ids) and activo and id is distinct from public.mi_usuario_id());
end $function$;
revoke execute on function public.anunciar_actualizacion(text, text, text[]) from public, anon;
grant execute on function public.anunciar_actualizacion(text, text, text[]) to authenticated;
