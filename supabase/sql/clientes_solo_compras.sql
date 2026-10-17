-- Clientes: solo quienes recibieron al menos un pedido (sin cancelados ni pendientes).
-- Además, el aviso de la venta en el local dice "servicio local" en vez de "alcancía".
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
create or replace function public.clientes(p_buscar text default null, p_limite integer default 50, p_desde integer default 0)
 returns table(telefono text, nombre text, barrio text, direccion text, pedidos bigint, entregados bigint, total numeric, ultimo timestamptz, total_filas bigint)
 language sql stable security definer set search_path to '' as $function$
  with base as (
    select regexp_replace(cliente_telefono, '\D', '', 'g') tel, cliente_nombre, barrio, direccion, estado, total, created_at
    from public.pedidos where cliente_telefono is not null and estado = 'entregado' and public.tiene_rol('admin')
  ), g as (
    select tel,
      (array_agg(cliente_nombre order by created_at desc))[1] nombre,
      (array_agg(barrio order by created_at desc))[1] barrio,
      (array_agg(direccion order by created_at desc))[1] direccion,
      count(*) pedidos, count(*) entregados,
      coalesce(sum(total), 0) total, max(created_at) ultimo
    from base where length(tel) >= 7 group by tel
  ), b as (select trim(coalesce(p_buscar,'')) t, regexp_replace(coalesce(p_buscar,''), '\D', '', 'g') d),
  f as (
    select g.* from g, b
    where b.t = '' or g.nombre ilike '%' || b.t || '%' or g.barrio ilike '%' || b.t || '%' or (b.d <> '' and g.tel like '%' || b.d || '%')
  )
  select tel, nombre, barrio, direccion, pedidos, entregados, total, ultimo, count(*) over ()
  from f order by ultimo desc limit p_limite offset p_desde
$function$;

do $$
declare s text := pg_get_functiondef('public.registrar_venta_local(text,text,text,jsonb,text,numeric,numeric,bigint,text[])'::regprocedure);
begin
  s := replace(s, ''' · alcancía $''', ''' · servicio local $''');
  s := replace(s, ''' para la alcancía)''', ''' para el servicio local)''');
  execute s;
end $$;
