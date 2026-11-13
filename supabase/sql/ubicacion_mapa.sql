-- YA APLICADO (2026-11-12). Queda aquí como registro.
-- 2026-11-13: se quitó el mapa de la app (Google no dejó activar la facturación).
-- Estas columnas y funciones quedaron en la base pero la app ya no las usa.
-- Ubicación exacta (punto en el mapa) de la dirección de entrega.

alter table public.pedidos add column if not exists lat double precision, add column if not exists lng double precision;
alter table public.pedidos_web add column if not exists lat double precision, add column if not exists lng double precision;

-- Llave de Google Maps para el navegador (restringida por dominio en Google Cloud).
-- Se guarda en el Vault con el nombre 'google_maps_key'; sin ella la app no muestra el mapa.
create or replace function public.maps_clave()
 returns text language sql stable security definer set search_path to ''
as $function$
  select decrypted_secret from vault.decrypted_secrets where name = 'google_maps_key' limit 1
$function$;
grant execute on function public.maps_clave() to anon, authenticated;

create or replace function privado.ubicacion_valida(p_lat double precision, p_lng double precision)
 returns boolean language sql immutable set search_path to ''
as $function$
  select (p_lat is null and p_lng is null) or (p_lat between -5 and 14 and p_lng between -82 and -66)
$function$;

-- Pedido de la app: lo puede ubicar quien participa (admin, alistamiento, la vendedora o el mensajero)
create or replace function public.pedido_ubicacion(p_pedido bigint, p_lat double precision, p_lng double precision)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.participa_en_pedido(p_pedido) then raise exception 'No participas en este pedido'; end if;
  if not privado.ubicacion_valida(p_lat, p_lng) then raise exception 'Ubicación no válida'; end if;
  update public.pedidos set lat = p_lat, lng = p_lng where id = p_pedido;
end $function$;
grant execute on function public.pedido_ubicacion(bigint, double precision, double precision) to authenticated;

-- Pedido de la tienda: quien lo hizo lo ubica con el código del pedido, en la primera media hora
create or replace function public.tienda_ubicacion(p_codigo uuid, p_lat double precision, p_lng double precision)
 returns void language plpgsql security definer set search_path to ''
as $function$
begin
  if p_lat is null or not privado.ubicacion_valida(p_lat, p_lng) then raise exception 'Ubicación no válida'; end if;
  update public.pedidos_web set lat = p_lat, lng = p_lng
   where codigo = p_codigo and created_at > now() - interval '30 minutes';
end $function$;
grant execute on function public.tienda_ubicacion(uuid, double precision, double precision) to anon, authenticated;

-- Al confirmar el pedido de la tienda, la ubicación pasa al pedido
create or replace function privado.web_pasa_ubicacion()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if new.pedido_id is not null and new.lat is not null and new.pedido_id is distinct from old.pedido_id then
    update public.pedidos set lat = new.lat, lng = new.lng where id = new.pedido_id and lat is null;
  end if;
  return new;
end $function$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'web_pasa_ubicacion') then
    create trigger web_pasa_ubicacion after update of pedido_id on public.pedidos_web
      for each row execute function privado.web_pasa_ubicacion();
  end if;
end $$;
