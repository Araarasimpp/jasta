-- ============================================================================
--  Cuadres por día de entrega · YA APLICADO en Supabase
--
--  Cada cuadre es de un solo día: el día (hora Colombia) en que se entregaron sus
--  pedidos, no el día en que se cierra. Si el mensajero no cerró el de ayer, le
--  quedan dos por cuadrar (ayer y hoy) y cada uno se cierra aparte.
-- ============================================================================

alter table public.cuadres add column if not exists fecha_entrega date;

-- Cuadres viejos: el día en que se entregaron la mayoría de sus pedidos
update public.cuadres c set fecha_entrega = x.dia
  from (select cuadre_id, mode() within group (order by (entregado_at at time zone 'America/Bogota')::date) as dia
          from public.pedidos where cuadre_id is not null and entregado_at is not null group by cuadre_id) x
 where x.cuadre_id = c.id and c.fecha_entrega is null;
update public.cuadres set fecha_entrega = (cerrado_at at time zone 'America/Bogota')::date where fecha_entrega is null;

create index if not exists cuadres_fecha_entrega_idx on public.cuadres (fecha_entrega desc);

-- Pendientes por cuadrar: uno por mensajero y día de entrega (el más viejo primero)
create or replace function public.cuadres_pendientes_dia()
returns table(mensajero_id bigint, nombre text, fecha date, pedidos bigint, efectivo numeric, transferencia numeric, domicilios numeric, desde timestamptz, hasta timestamptz)
language sql stable security definer set search_path to '' as $function$
  select u.id, u.nombre, (p.entregado_at at time zone 'America/Bogota')::date, count(*),
         coalesce(sum(p.valor_efectivo),0), coalesce(sum(p.valor_transferencia),0), coalesce(sum(p.valor_domicilio),0),
         min(p.entregado_at), max(p.entregado_at)
  from public.pedidos p join public.usuarios u on u.id = p.mensajero_id
  where p.estado = 'entregado' and p.cuadre_id is null
    and (public.tiene_rol('admin') or public.tiene_rol('cuadres') or p.mensajero_id = public.mi_usuario_id())
  group by u.id, u.nombre, 3 order by 3, u.nombre
$function$;
revoke execute on function public.cuadres_pendientes_dia() from public, anon;
grant execute on function public.cuadres_pendientes_dia() to authenticated;

-- Cierra el cuadre de un mensajero para UN día de entrega
create or replace function public.cerrar_cuadre(p_mensajero bigint, p_fecha date)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint;
  v_propio boolean := p_mensajero = public.mi_usuario_id();
  v_oficina boolean := (public.tiene_rol('admin') or public.tiene_rol('cuadres')) and not (p_mensajero = public.mi_usuario_id());
begin
  if not (v_oficina or public.tiene_rol('admin') or public.tiene_rol('cuadres') or (public.tiene_rol('mensajero') and v_propio)) then
    raise exception 'No tienes permiso para cerrar este cuadre';
  end if;
  if p_fecha is null then raise exception 'Falta el día del cuadre'; end if;
  if not exists (select 1 from public.pedidos where mensajero_id = p_mensajero and estado = 'entregado' and cuadre_id is null
                   and (entregado_at at time zone 'America/Bogota')::date = p_fecha) then
    raise exception 'No hay pedidos pendientes por cuadrar ese día';
  end if;
  -- La oficina cerrando el de otro = ya recibió la plata (confirmado).
  -- El propio cuadre (aunque seas admin) queda por confirmar hasta que la oficina confirme que recibió la plata.
  insert into public.cuadres (codigo, mensajero_id, fecha_entrega, cerrado_por, cerrado_por_nombre, cantidad_pedidos, total_efectivo, total_transferencia, total_domicilios,
                              estado, confirmado_at, confirmado_por, confirmado_por_nombre)
  select 'cuadre_' || p_mensajero || '_' || to_char(p_fecha, 'YYYYMMDD') || '_' || to_char(now() at time zone 'America/Bogota','YYYYMMDDHH24MISS'), p_mensajero, p_fecha,
         public.mi_usuario_id(), public.mi_nombre(), count(*), coalesce(sum(valor_efectivo),0), coalesce(sum(valor_transferencia),0), coalesce(sum(valor_domicilio),0),
         case when v_oficina then 'confirmado' else 'pendiente' end,
         case when v_oficina then now() end, case when v_oficina then public.mi_usuario_id() end, case when v_oficina then public.mi_nombre() end
    from public.pedidos where mensajero_id = p_mensajero and estado = 'entregado' and cuadre_id is null
     and (entregado_at at time zone 'America/Bogota')::date = p_fecha
  returning id into v_id;
  update public.pedidos set cuadre_id = v_id
   where mensajero_id = p_mensajero and estado = 'entregado' and cuadre_id is null
     and (entregado_at at time zone 'America/Bogota')::date = p_fecha;
  return v_id;
end $function$;
revoke execute on function public.cerrar_cuadre(bigint, date) from public, anon;
grant execute on function public.cerrar_cuadre(bigint, date) to authenticated;

-- Sin día (lo usa la app de Variedades JYB): cierra el día pendiente más viejo
create or replace function public.cerrar_cuadre(p_mensajero bigint)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_dia date;
begin
  select min((entregado_at at time zone 'America/Bogota')::date) into v_dia
    from public.pedidos where mensajero_id = p_mensajero and estado = 'entregado' and cuadre_id is null;
  if v_dia is null then raise exception 'No hay pedidos pendientes por cuadrar'; end if;
  return public.cerrar_cuadre(p_mensajero, v_dia);
end $function$;

-- Variedades JYB: "por cuadrar" muestra el día más viejo (el que se cierra con el botón)
create or replace function public.kaesuri_resumen(p_email text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare v_men bigint := public.kaesuri_mensajero(p_email); v_dia date;
begin
  if v_men is null then
    return jsonb_build_object('vinculado', false);
  end if;
  select min((entregado_at at time zone 'America/Bogota')::date) into v_dia
    from public.pedidos where mensajero_id = v_men and estado = 'entregado' and cuadre_id is null;
  return jsonb_build_object(
    'vinculado', true,
    'canal', 'kaesuri-entregas:' || auth.uid(),
    'en_ruta', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'cliente_nombre', p.cliente_nombre, 'cliente_telefono', p.cliente_telefono,
               'direccion', p.direccion, 'barrio', p.barrio, 'valor_domicilio', p.valor_domicilio, 'total', p.total,
               'observaciones', p.observaciones, 'asignado_at', p.asignado_at, 'vendedora', v.nombre,
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'color', i.color,
                                                     'talla', i.talla, 'total', i.total) order by i.id)
                   from public.pedido_items i where i.pedido_id = p.id), '[]'::jsonb))
             order by p.asignado_at nulls first, p.id)
        from public.pedidos p left join public.usuarios v on v.id = p.vendedora_id
       where p.mensajero_id = v_men and p.estado = 'despachado'), '[]'::jsonb),
    'por_cuadrar', (
      select jsonb_build_object('pedidos', count(*), 'efectivo', coalesce(sum(valor_efectivo), 0),
                                'transferencia', coalesce(sum(valor_transferencia), 0),
                                'domicilios', coalesce(sum(valor_domicilio), 0), 'desde', min(entregado_at),
                                'fecha', v_dia,
                                'dias_pendientes', (select count(distinct (entregado_at at time zone 'America/Bogota')::date)
                                                      from public.pedidos where mensajero_id = v_men and estado = 'entregado' and cuadre_id is null))
        from public.pedidos
       where mensajero_id = v_men and estado = 'entregado' and cuadre_id is null
         and (entregado_at at time zone 'America/Bogota')::date = v_dia),
    'por_confirmar', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'cerrado_at', c.cerrado_at, 'fecha_entrega', c.fecha_entrega, 'cantidad_pedidos', c.cantidad_pedidos,
                                          'total_a_entregar', c.total_efectivo - c.total_domicilios) order by c.fecha_entrega, c.cerrado_at)
        from public.cuadres c
       where c.mensajero_id = v_men and c.estado = 'pendiente'), '[]'::jsonb));
end;
$function$;
