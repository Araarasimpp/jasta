-- YA APLICADO (2026-11-15). Queda aquí como registro.
-- Los pedidos que se suben desde las 8:00 p. m. (hora de Colombia) cuentan para el día siguiente:
-- created_at pasa a las 12:00 a. m. del otro día (más unos segundos para no perder el orden) y la
-- hora real queda en subido_at. Así todos los reportes, el ranking, las metas y las comisiones
-- (que van por created_at) los cuentan al día siguiente. No aplica a las ventas del local (su
-- caja se cierra esa misma noche) ni a filas que llegan con una fecha vieja (sincronización).

alter table public.pedidos add column if not exists subido_at timestamptz;

create or replace function privado.pedido_dia_siguiente()
 returns trigger language plpgsql set search_path to ''
as $function$
declare v_local timestamp := new.created_at at time zone 'America/Bogota';
begin
  if coalesce(new.canal, 'domicilio') <> 'local' and new.created_at > now() - interval '2 minutes'
     and extract(hour from v_local) >= 20 then
    new.subido_at := new.created_at;
    new.created_at := ((v_local::date + 1)::timestamp at time zone 'America/Bogota')
      + (v_local - (v_local::date + time '20:00')) / 240;
  end if;
  return new;
end $function$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'a_pedido_dia_siguiente') then
    create trigger a_pedido_dia_siguiente before insert on public.pedidos
      for each row execute function privado.pedido_dia_siguiente();
  end if;
end $$;

-- Donde importa la hora real (horas de venta, tiempos de espera) se usa subido_at si existe
do $$ declare f regprocedure; d text; n text; begin
  f := 'public.ventas_por_hora(date,date)'::regprocedure;
  d := pg_get_functiondef(f);
  n := replace(replace(d,
    'extract(isodow from p.created_at at time zone', 'extract(isodow from coalesce(p.subido_at, p.created_at) at time zone'),
    'extract(hour from p.created_at at time zone', 'extract(hour from coalesce(p.subido_at, p.created_at) at time zone');
  if n = d then raise exception 'ventas_por_hora sin cambio'; end if;
  execute n;

  select p.oid::regprocedure into f from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'tienda_estimado';
  d := pg_get_functiondef(f);
  n := replace(replace(replace(d,
    'extract(hour from p.created_at at time zone', 'extract(hour from coalesce(p.subido_at, p.created_at) at time zone'),
    '= (p.created_at at time zone', '= (coalesce(p.subido_at, p.created_at) at time zone'),
    '(p.asignado_at - p.created_at)', '(p.asignado_at - coalesce(p.subido_at, p.created_at))');
  if n = d then raise exception 'tienda_estimado sin cambio'; end if;
  execute n;

  select p.oid::regprocedure into f from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'resumen_operacion';
  d := pg_get_functiondef(f);
  n := replace(replace(replace(d,
    'order by alistado_at - created_at', 'order by alistado_at - coalesce(subido_at, created_at)'),
    'alistado_at > created_at', 'alistado_at > coalesce(subido_at, created_at)'),
    'min(created_at) from public.pedidos', 'min(coalesce(subido_at, created_at)) from public.pedidos');
  if n = d then raise exception 'resumen_operacion sin cambio'; end if;
  execute n;

  select p.oid::regprocedure into f from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'privado' and p.proname = 'revisar_quietos';
  d := pg_get_functiondef(f);
  n := replace(replace(d,
    'when ''por_alistar'' then p.created_at', 'when ''por_alistar'' then coalesce(p.subido_at, p.created_at)'),
    'end, p.created_at)', 'end, coalesce(p.subido_at, p.created_at))');
  if n = d then raise exception 'revisar_quietos sin cambio'; end if;
  execute n;
end $$;
