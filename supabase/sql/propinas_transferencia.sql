-- Propinas por transferencia (PENDIENTE DE APLICAR)
-- Si el cliente transfiere más del total (ej. paga $81.000 por un pedido de $79.000), lo que sobra
-- es propina del mensajero. Esa plata queda en la cuenta del negocio, así que en el cuadre se le
-- descuenta de lo que entrega, igual que sus domicilios. El total del pedido no cambia: ventas,
-- reportes y ganancias siguen igual. La propina en efectivo no se registra (ya la tiene él).

alter table public.pedidos add column if not exists propina numeric not null default 0 check (propina >= 0);
alter table public.cuadres add column if not exists total_propinas numeric not null default 0;

-- 1) Entregar con propina
drop function if exists public.entregar_pedido(bigint, text, numeric, numeric, text[]);
create or replace function public.entregar_pedido(p_pedido bigint, p_tipo text, p_efectivo numeric, p_transferencia numeric,
  p_evidencias text[], p_propina numeric default 0)
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_yo bigint := public.mi_usuario_id(); v_ev text[]; v_prop numeric := round(greatest(coalesce(p_propina, 0), 0));
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.tiene_rol('admin') or p.mensajero_id = v_yo) then raise exception 'Este pedido no está asignado a ti'; end if;
  if p.estado not in ('despachado','alistado','por_alistar') then raise exception 'El pedido ya está %', lower(public.estado_label(p.estado)); end if;
  if p_tipo not in ('efectivo','transferencia','mixto') then raise exception 'Forma de pago inválida'; end if;
  if v_prop > 0 and p_tipo = 'efectivo' then raise exception 'La propina en efectivo no se registra: ya la tienes tú'; end if;
  if v_prop > p.total then raise exception 'Revisa la propina: es más que el valor del pedido'; end if;
  v_ev := privado.comprobantes_validos(p_evidencias);
  if p_tipo in ('transferencia', 'mixto') and cardinality(v_ev) = 0 then raise exception 'Sube la foto del comprobante de la transferencia'; end if;
  if p_tipo = 'efectivo' then p_efectivo := p.total; p_transferencia := 0;
  elsif p_tipo = 'transferencia' then p_efectivo := 0; p_transferencia := p.total;
  elsif coalesce(p_efectivo,0) + coalesce(p_transferencia,0) <> p.total then
    raise exception 'Efectivo + transferencia debe sumar % (la propina va aparte)', p.total;
  end if;
  update public.pedidos set estado = 'entregado', entregado_at = now(), updated_at = now(),
    tipo_recaudo = p_tipo, valor_efectivo = p_efectivo, valor_transferencia = p_transferencia, propina = v_prop,
    mensajero_id = coalesce(mensajero_id, v_yo), stock_descontado = true,
    evidencias = case when cardinality(v_ev) > 0 then coalesce(evidencias, '{}') || v_ev else evidencias end
  where id = p_pedido;
  if not p.stock_descontado then
    update public.productos pr set stock = pr.stock - i.cantidad, updated_at = now()
      from public.pedido_items i where i.pedido_id = p.id and i.producto_id = pr.id and pr.controla_stock;
  end if;
  perform public.nota(p_pedido, 'Entregado · ' || p_tipo || case when cardinality(v_ev) > 0 then ' · comprobante adjunto' else '' end
    || case when v_prop > 0 then ' · propina por transferencia ' || privado.pesos(v_prop) else '' end);
end $function$;
revoke execute on function public.entregar_pedido(bigint, text, numeric, numeric, text[], numeric) from public, anon;
grant execute on function public.entregar_pedido(bigint, text, numeric, numeric, text[], numeric) to authenticated, service_role;

-- 2) Cuadres por cerrar: con las propinas
drop function if exists public.cuadres_pendientes();
create function public.cuadres_pendientes()
returns table(mensajero_id bigint, nombre text, pedidos bigint, efectivo numeric, transferencia numeric, domicilios numeric, desde timestamptz, propinas numeric)
language sql stable security definer set search_path to '' as $function$
  select u.id, u.nombre, count(*), coalesce(sum(p.valor_efectivo),0), coalesce(sum(p.valor_transferencia),0), coalesce(sum(p.valor_domicilio),0), min(p.entregado_at),
    coalesce(sum(p.propina),0)
  from public.pedidos p join public.usuarios u on u.id = p.mensajero_id
  where p.estado = 'entregado' and p.cuadre_id is null
    and (public.tiene_rol('admin') or public.tiene_rol('cuadres') or p.mensajero_id = public.mi_usuario_id())
  group by u.id, u.nombre order by count(*) desc
$function$;

drop function if exists public.cuadres_pendientes_dia();
create function public.cuadres_pendientes_dia()
returns table(mensajero_id bigint, nombre text, fecha date, pedidos bigint, efectivo numeric, transferencia numeric, domicilios numeric, desde timestamptz, hasta timestamptz, propinas numeric)
language sql stable security definer set search_path to '' as $function$
  select u.id, u.nombre, (p.entregado_at at time zone 'America/Bogota')::date, count(*),
         coalesce(sum(p.valor_efectivo),0), coalesce(sum(p.valor_transferencia),0), coalesce(sum(p.valor_domicilio),0),
         min(p.entregado_at), max(p.entregado_at), coalesce(sum(p.propina),0)
  from public.pedidos p join public.usuarios u on u.id = p.mensajero_id
  where p.estado = 'entregado' and p.cuadre_id is null
    and (public.tiene_rol('admin') or public.tiene_rol('cuadres') or p.mensajero_id = public.mi_usuario_id())
  group by u.id, u.nombre, 3 order by 3, u.nombre
$function$;
revoke execute on function public.cuadres_pendientes(), public.cuadres_pendientes_dia() from public, anon;
grant execute on function public.cuadres_pendientes(), public.cuadres_pendientes_dia() to authenticated;

-- 3) Cambios puntuales en otras funciones
do $$
declare
  v_def text;
  c text[];
  cambios text[][] := array[
    -- El cuadre guarda el total de propinas
    ['public.cerrar_cuadre(bigint,date)',
     'cantidad_pedidos, total_efectivo, total_transferencia, total_domicilios,',
     'cantidad_pedidos, total_efectivo, total_transferencia, total_domicilios, total_propinas,'],
    ['public.cerrar_cuadre(bigint,date)',
     'coalesce(sum(valor_transferencia),0), coalesce(sum(valor_domicilio),0),',
     'coalesce(sum(valor_transferencia),0), coalesce(sum(valor_domicilio),0), coalesce(sum(propina),0),'],
    -- Devolver una entrega borra la propina
    ['public.devolver_entrega(bigint)',
     'tipo_recaudo = null, valor_efectivo = null, valor_transferencia = null,',
     'tipo_recaudo = null, valor_efectivo = null, valor_transferencia = null, propina = 0,'],
    -- Cierre del día: lo que falta por recibir descuenta las propinas
    ['privado.cierre_dia_texto(date)',
     'sum(coalesce(valor_efectivo, 0) - coalesce(valor_domicilio, 0))',
     'sum(coalesce(valor_efectivo, 0) - coalesce(valor_domicilio, 0) - coalesce(propina, 0))'],
    -- Mi resumen del mensajero: propinas del periodo y por cuadrar
    ['public.resumen_mensajero(date,date,bigint)',
     '''domicilios'', coalesce(sum(valor_domicilio), 0))',
     '''domicilios'', coalesce(sum(valor_domicilio), 0), ''propinas'', coalesce(sum(propina), 0))'],
    ['public.resumen_mensajero(date,date,bigint)',
     '''ganado'', (select coalesce(sum(valor_domicilio), 0) from ent),',
     '''ganado'', (select coalesce(sum(valor_domicilio), 0) from ent), ''propinas'', (select coalesce(sum(propina), 0) from ent),']
  ];
begin
  foreach c slice 1 in array cambios loop
    v_def := regexp_replace(pg_get_functiondef(c[1]::regprocedure), E'\r', '', 'g');
    if position(c[3] in v_def) > 0 then continue; end if;
    if position(c[2] in v_def) = 0 then raise exception 'No encontré dónde cambiar %', c[1]; end if;
    execute replace(v_def, c[2], c[3]);
  end loop;
end $$;
