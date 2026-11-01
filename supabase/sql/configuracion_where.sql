-- Arreglo: Supabase bloquea los UPDATE sin WHERE (pg-safeupdate) cuando se llaman desde la app,
-- así que "Se cuentan las entregas desde" y "Datos para la DIAN" fallaban con
-- "UPDATE requires a WHERE clause". La configuración es una sola fila (id = true). (YA APLICADO)

create or replace function public.guardar_liquidar_desde(p_dia date)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if p_dia is null then raise exception 'Elige un día'; end if;
  update public.configuracion set liquidar_desde = p_dia, updated_at = now() where id = true;
end $function$;

create or replace function public.guardar_datos_fiscales(p_nit text, p_direccion text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  update public.configuracion set nit = nullif(left(trim(coalesce(p_nit, '')), 30), ''),
    direccion = nullif(left(trim(coalesce(p_direccion, '')), 160), ''), updated_at = now()
  where id = true;
end $function$;

-- Las comisiones se cuentan desde el sábado 24 de octubre de 2026
update public.configuracion set liquidar_desde = '2026-10-24', updated_at = now() where id = true;
