-- Borrar cuentas (PENDIENTE DE APLICAR)
-- La persona puede borrar su propia cuenta y el admin puede borrar cuentas que no se usan.
-- Siempre se borra el acceso (usuario de Auth: correo, contraseña, Face ID, sesiones) y los datos
-- personales (cédula y cuenta bancaria, teléfono, foto, celulares para avisos, Telegram).
-- Si la cuenta no tiene historial se borra del todo; si tiene pedidos, comisiones, cuadres, etc.,
-- queda solo el nombre para que esos registros no se rompan (marcada como eliminada).

alter table public.usuarios add column if not exists eliminado_at timestamptz;

create or replace function privado.borrar_cuenta(p_usuario bigint)
returns text language plpgsql security definer set search_path to '' as $function$
declare u public.usuarios;
begin
  select * into u from public.usuarios where id = p_usuario for update;
  if not found then raise exception 'Esa cuenta no existe'; end if;
  if u.auth_id is not null then delete from auth.users where id = u.auth_id; end if;
  delete from public.datos_pago where usuario_id = u.id;
  delete from public.push_suscripciones where usuario_id = u.id;
  delete from public.telegram_usuarios where usuario_id = u.id;
  delete from public.notificaciones where usuario_id = u.id;
  begin
    delete from public.usuarios where id = u.id;
    return 'borrada';
  exception when foreign_key_violation then
    update public.usuarios set activo = false, eliminado_at = now(), email = null, telefono = null, avatar_url = null, auth_id = null
     where id = u.id;
    return 'eliminada';
  end;
end $function$;
revoke execute on function privado.borrar_cuenta(bigint) from public, anon, authenticated;

-- Quedaría sin ningún admin activo
create or replace function privado.ultimo_admin(p_usuario bigint)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (select 1 from public.usuarios where id = p_usuario and 'admin' = any (roles::text[]))
     and not exists (select 1 from public.usuarios where id <> p_usuario and activo and eliminado_at is null and 'admin' = any (roles::text[]))
$$;
revoke execute on function privado.ultimo_admin(bigint) from public, anon, authenticated;

create or replace function public.eliminar_mi_cuenta()
returns text language plpgsql security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  if privado.ultimo_admin(v_yo) then raise exception 'Eres el único admin: antes de borrar tu cuenta, dale el rol de admin a otra persona'; end if;
  return privado.borrar_cuenta(v_yo);
end $function$;

create or replace function public.eliminar_cuenta(p_usuario bigint)
returns text language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede borrar cuentas'; end if;
  if p_usuario = public.mi_usuario_id() then raise exception 'Tu propia cuenta se borra desde Mi perfil'; end if;
  if privado.ultimo_admin(p_usuario) then raise exception 'No se puede borrar al único admin'; end if;
  return privado.borrar_cuenta(p_usuario);
end $function$;

-- Último ingreso de cada cuenta (para ver las que no se usan)
create or replace function public.usuarios_ultimo_ingreso()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_object_agg(u.id, a.last_sign_in_at) from public.usuarios u join auth.users a on a.id = u.auth_id), '{}');
end $function$;

revoke execute on function public.eliminar_mi_cuenta(), public.eliminar_cuenta(bigint), public.usuarios_ultimo_ingreso() from public, anon;
grant execute on function public.eliminar_mi_cuenta(), public.eliminar_cuenta(bigint), public.usuarios_ultimo_ingreso() to authenticated;
