-- Respaldo semanal en Excel por Telegram (YA APLICADO)
-- Los domingos a las 9:15 p. m. (hora Colombia) la base le pide a la Edge Function
-- respaldo-semanal que arme el Excel de los últimos 7 días y se lo mande a cada admin
-- con su cuenta vinculada al bot. Un admin también lo puede pedir desde Configuración.

create or replace function privado.enviar_respaldo(p_hasta date default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_secreto text;
begin
  select secreto into v_secreto from privado.push_config where id;
  perform net.http_post(
    url := 'https://ktksdoedeazkvohewqzx.supabase.co/functions/v1/respaldo-semanal',
    body := jsonb_build_object('hasta', coalesce(p_hasta, (now() at time zone 'America/Bogota')::date)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-respaldo-secreto', v_secreto),
    timeout_milliseconds := 60000);
end $function$;
revoke execute on function privado.enviar_respaldo(date) from public, anon, authenticated;

-- Desde Configuración: cuántos admins lo van a recibir (0 = nadie tiene el bot vinculado)
create or replace function public.pedir_respaldo()
returns integer language plpgsql security definer set search_path to '' as $function$
declare n int;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede pedir el respaldo'; end if;
  if not exists (select 1 from privado.telegram_config where token is not null) then raise exception 'Primero conecta el bot de Telegram'; end if;
  select count(distinct t.telegram_id) into n from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id
   where u.activo and 'admin' = any (u.roles::text[]);
  if n = 0 then raise exception 'Ningún admin tiene su cuenta vinculada al bot de Telegram'; end if;
  perform privado.enviar_respaldo(null);
  return n;
end $function$;
revoke execute on function public.pedir_respaldo() from public, anon;
grant execute on function public.pedir_respaldo() to authenticated;

-- Domingo 9:15 p. m. Colombia = lunes 02:15 UTC (la semana termina el domingo)
select cron.schedule('respaldo-semanal', '15 2 * * 1', $$select privado.enviar_respaldo(((now() at time zone 'America/Bogota')::date))$$);
