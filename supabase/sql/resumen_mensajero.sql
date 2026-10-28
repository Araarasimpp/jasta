-- Panel "Mi resumen" del domiciliario (YA APLICADO)
-- Lo que ganó en domicilios en el periodo (y contra el periodo anterior del mismo largo),
-- entregas por día, los barrios a los que más fue, efectividad, calificaciones y lo que
-- tiene por cuadrar. El mensajero ve lo suyo; el admin puede ver el de cualquiera.

create or replace function privado.barrio_normal(p text)
returns text language sql immutable set search_path to '' as $$
  select nullif(regexp_replace(lower(translate(trim(coalesce(p, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '\s+', ' ', 'g'), '')
$$;

create or replace function public.resumen_mensajero(p_desde date, p_hasta date, p_mensajero bigint default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  v_id bigint;
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_largo int := p_hasta - p_desde + 1;
  d0 timestamptz;
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  v_id := case when p_mensajero is not null and public.tiene_rol('admin') then p_mensajero else v_yo end;
  if v_id = v_yo and not (public.tiene_rol('mensajero') or public.tiene_rol('admin')) then raise exception 'Sin permiso'; end if;
  d0 := ((p_desde - v_largo)::text || ' 00:00 America/Bogota')::timestamptz;
  return (
    with ent as (
      select p.* from public.pedidos p
      where p.mensajero_id = v_id and p.estado = 'entregado' and p.entregado_at >= d and p.entregado_at < h
    ), barrios as (
      select privado.barrio_normal(barrio) k, count(*) n, sum(valor_domicilio) dom,
        (array_agg(trim(barrio) order by entregado_at desc))[1] visto
      from ent where privado.barrio_normal(barrio) is not null group by 1
    )
    select jsonb_build_object(
      'nombre', (select nombre from public.usuarios where id = v_id),
      'ganado', (select coalesce(sum(valor_domicilio), 0) from ent),
      'entregas', (select count(*) from ent),
      'dias_trabajados', (select count(distinct (entregado_at at time zone 'America/Bogota')::date) from ent),
      'anterior', (select jsonb_build_object('ganado', coalesce(sum(valor_domicilio), 0), 'entregas', count(*))
                   from public.pedidos where mensajero_id = v_id and estado = 'entregado' and entregado_at >= d0 and entregado_at < d),
      'cancelados_en_ruta', (select count(*) from public.pedidos where mensajero_id = v_id and estado = 'cancelado' and asignado_at >= d and asignado_at < h),
      'novedades', (select count(*) from public.pedido_novedades where mensajero_id = v_id and created_at >= d and created_at < h),
      'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', g::date, 'entregas', coalesce(x.n, 0), 'ganado', coalesce(x.dom, 0)) order by g), '[]')
        from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') g
        left join (select (entregado_at at time zone 'America/Bogota')::date dia, count(*) n, sum(valor_domicilio) dom from ent group by 1) x on x.dia = g::date),
      'por_hora', (select coalesce(jsonb_agg(jsonb_build_object('hora', hr, 'entregas', n) order by hr), '[]') from (
        select extract(hour from entregado_at at time zone 'America/Bogota')::int hr, count(*) n from ent group by 1) s),
      'barrios', (select coalesce(jsonb_agg(jsonb_build_object('barrio', coalesce(t.barrio, b.visto), 'entregas', b.n, 'ganado', b.dom) order by b.n desc, b.dom desc), '[]')
        from (select * from barrios order by n desc, dom desc limit 8) b
        left join lateral (select barrio from public.tarifas_domicilio t where privado.barrio_normal(t.barrio) = b.k limit 1) t on true),
      'barrios_distintos', (select count(*) from barrios),
      'calificacion', (select jsonb_build_object('promedio', round(avg(estrellas), 1), 'cantidad', count(*))
                       from public.calificaciones where mensajero_id = v_id and created_at >= d and created_at < h),
      'comentarios', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('estrellas', k.estrellas, 'comentario', k.comentario, 'fecha', k.created_at) x
        from public.calificaciones k where k.mensajero_id = v_id and k.comentario is not null and k.created_at >= d and k.created_at < h
        order by k.created_at desc limit 5) s),
      'por_cuadrar', (select jsonb_build_object('pedidos', count(*), 'efectivo', coalesce(sum(valor_efectivo), 0), 'domicilios', coalesce(sum(valor_domicilio), 0))
                      from public.pedidos where mensajero_id = v_id and estado = 'entregado' and cuadre_id is null)
    ));
end $function$;

revoke execute on function public.resumen_mensajero(date, date, bigint) from public, anon;
grant execute on function public.resumen_mensajero(date, date, bigint) to authenticated;
