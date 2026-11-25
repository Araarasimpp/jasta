-- ============================================================================
--  Jasta · Devoluciones, cambios y garantías: rótulo propio, domicilio como
--  gasto, deducible contra entrega, estados de la garantía y aviso de la 1 p. m.
--  YA APLICADO en Supabase (proyecto Jasta); se guarda como registro.
--
--  * Domicilio: lo paga el negocio. Se anota solo en Gastos (categoría
--    Transporte, "Domicilio de cambio/garantía del pedido #…").
--  * Cambio por otro producto más caro: la diferencia (deducible) se puede
--    cobrar contra entrega; el rótulo dice "COBRAR $…".
--  * Garantía: estados (Recibida, En arreglo con …, Esperando repuesto, Lista
--    para entregar, En camino, Entregada, No tiene arreglo) con su historial.
--    Entregada = resuelta.
--  * Todos los días a la 1 p. m., si hay garantías sin resolver, aviso a
--    admin y alistamiento (y franja en la app, como las transferencias).
-- ============================================================================

alter table public.devoluciones
  add column if not exists domicilio numeric not null default 0,
  add column if not exists domicilio_gasto_id bigint,
  add column if not exists garantia_estado text,
  add column if not exists garantia_detalle text,
  add column if not exists rotulo_at timestamptz;

create table if not exists public.garantia_estados (
  id bigserial primary key,
  devolucion_id bigint not null references public.devoluciones(id),
  estado text not null,
  detalle text,
  autor text,
  created_at timestamptz not null default now()
);
alter table public.garantia_estados enable row level security;
create index if not exists garantia_estados_dev on public.garantia_estados (devolucion_id, created_at);

create or replace function privado.estado_garantia(p text)
returns text language sql immutable set search_path to '' as $function$
  select case p
    when 'recibida' then 'Recibida en la tienda'
    when 'en_arreglo' then 'En arreglo'
    when 'esperando_repuesto' then 'Esperando repuesto'
    when 'lista' then 'Lista para entregar'
    when 'en_camino' then 'En camino al cliente'
    when 'entregada' then 'Entregada al cliente'
    when 'sin_arreglo' then 'No tiene arreglo'
    else coalesce(p, 'Recibida en la tienda') end
$function$;

-- Estado de una garantía (con detalle: "con el técnico Carlos", "le falta el cargador"…)
create or replace function public.garantia_estado(p_id bigint, p_estado text, p_detalle text)
returns void language plpgsql security definer set search_path to '' as $function$
declare d public.devoluciones; v_det text := privado.limpio(p_detalle, 200);
begin
  if not privado.puede_devoluciones() then raise exception 'Sin permiso'; end if;
  if p_estado not in ('recibida', 'en_arreglo', 'esperando_repuesto', 'lista', 'en_camino', 'entregada', 'sin_arreglo') then
    raise exception 'Estado inválido';
  end if;
  if p_estado = 'en_arreglo' and v_det is null then raise exception 'Escribe con quién está en arreglo'; end if;
  select * into d from public.devoluciones where id = p_id for update;
  if not found or d.tipo <> 'garantia' then raise exception 'Esa garantía no existe'; end if;
  update public.devoluciones set garantia_estado = p_estado, garantia_detalle = v_det,
      tecnico = case when p_estado = 'en_arreglo' then v_det else tecnico end,
      tecnico_fecha = case when p_estado = 'en_arreglo' then coalesce(tecnico_fecha, (now() at time zone 'America/Bogota')::date) else tecnico_fecha end,
      resuelta_at = case when p_estado = 'entregada' then coalesce(resuelta_at, now()) else null end
   where id = d.id;
  insert into public.garantia_estados (devolucion_id, estado, detalle, autor) values (d.id, p_estado, v_det, public.mi_nombre());
  perform public.nota(d.pedido_id, 'Garantía: ' || privado.estado_garantia(p_estado)
    || case when p_estado = 'en_arreglo' then ' con ' else '' end || coalesce(case when p_estado = 'en_arreglo' then v_det else ' · ' || v_det end, ''));
end $function$;
revoke execute on function public.garantia_estado(bigint, text, text) from public, anon;
grant execute on function public.garantia_estado(bigint, text, text) to authenticated;

create or replace function public.garantia_historial(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not privado.puede_devoluciones() then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('estado', privado.estado_garantia(e.estado), 'detalle', e.detalle, 'autor', e.autor, 'fecha', e.created_at)
    order by e.created_at desc) from public.garantia_estados e where e.devolucion_id = p_id), '[]'::jsonb);
end $function$;
revoke execute on function public.garantia_historial(bigint) from public, anon;
grant execute on function public.garantia_historial(bigint) to authenticated;

-- Domicilio de un cambio, garantía o devolución: lo paga el negocio y queda como gasto (Transporte)
create or replace function public.devolucion_domicilio(p_id bigint, p_valor numeric)
returns void language plpgsql security definer set search_path to '' as $function$
declare d public.devoluciones; v numeric := greatest(round(coalesce(p_valor, 0)), 0); v_tipo text;
begin
  if not privado.puede_devoluciones() then raise exception 'Sin permiso'; end if;
  select * into d from public.devoluciones where id = p_id for update;
  if not found then raise exception 'No existe'; end if;
  v_tipo := case d.tipo when 'cambio' then 'cambio' when 'garantia' then 'garantía' else 'devolución' end;
  if d.domicilio_gasto_id is not null and exists (select 1 from public.gastos where id = d.domicilio_gasto_id) then
    if v = 0 then
      delete from public.gastos where id = d.domicilio_gasto_id;
      update public.devoluciones set domicilio = 0, domicilio_gasto_id = null where id = d.id;
    else
      update public.gastos set valor = v where id = d.domicilio_gasto_id;
      update public.devoluciones set domicilio = v where id = d.id;
    end if;
  elsif v > 0 then
    insert into public.gastos (fecha, categoria, descripcion, valor, metodo, comprobantes, creado_por, creado_por_nombre)
    values ((now() at time zone 'America/Bogota')::date, 'transporte', 'Domicilio de ' || v_tipo || ' del pedido #' || d.pedido_id, v, 'efectivo', '{}',
            public.mi_usuario_id(), public.mi_nombre())
    returning id into d.domicilio_gasto_id;
    update public.devoluciones set domicilio = v, domicilio_gasto_id = d.domicilio_gasto_id where id = d.id;
  else
    update public.devoluciones set domicilio = 0, domicilio_gasto_id = null where id = d.id;
  end if;
  if v > 0 then perform public.nota(d.pedido_id, 'Domicilio del ' || v_tipo || ': ' || privado.pesos(v) || ' (lo paga el negocio, va a Gastos)'); end if;
end $function$;
revoke execute on function public.devolucion_domicilio(bigint, numeric) from public, anon;
grant execute on function public.devolucion_domicilio(bigint, numeric) to authenticated;

-- Garantías sin resolver (todas las fechas): para la franja de aviso y la lista de arriba en Devoluciones
create or replace function public.garantias_pendientes()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not privado.puede_devoluciones() then return jsonb_build_object('n', 0, 'lista', '[]'::jsonb); end if;
  return (select jsonb_build_object('n', count(*), 'lista', coalesce(jsonb_agg(jsonb_build_object(
      'id', dv.id, 'pedido_id', dv.pedido_id, 'cliente', pe.cliente_nombre, 'estado', coalesce(dv.garantia_estado, 'recibida'),
      'estado_texto', privado.estado_garantia(dv.garantia_estado), 'detalle', dv.garantia_detalle, 'nota', dv.nota, 'fecha', dv.created_at,
      'items', (select jsonb_agg(jsonb_build_object('nombre', di.nombre, 'cantidad', di.cantidad) order by di.id) from public.devolucion_items di where di.devolucion_id = dv.id))
      order by dv.created_at), '[]'::jsonb))
    from public.devoluciones dv join public.pedidos pe on pe.id = dv.pedido_id
    where dv.tipo = 'garantia' and dv.resuelta_at is null);
end $function$;
revoke execute on function public.garantias_pendientes() from public, anon;
grant execute on function public.garantias_pendientes() to authenticated;

-- Aviso diario a la 1 p. m. (18:00 UTC) si hay garantías sin resolver
create or replace function privado.recordar_garantias()
returns void language plpgsql security definer set search_path to '' as $function$
declare v_n int; v_lista text;
begin
  select count(*), string_agg('#' || dv.pedido_id || ' ' || pe.cliente_nombre || ' (' || lower(privado.estado_garantia(dv.garantia_estado)) || ')', ', ' order by dv.created_at)
    into v_n, v_lista
  from public.devoluciones dv join public.pedidos pe on pe.id = dv.pedido_id
  where dv.tipo = 'garantia' and dv.resuelta_at is null;
  if v_n > 0 then
    perform privado.avisar(privado.con_rol(array['admin', 'alistador']), 'garantia',
      case when v_n = 1 then 'Tienes 1 garantía pendiente' else 'Tienes ' || v_n || ' garantías pendientes' end,
      left(v_lista, 300), '/app/devoluciones', null);
  end if;
end $function$;
select cron.schedule('recordar-garantias', '0 18 * * *', 'select privado.recordar_garantias()');

-- registrar_cambio_otro: la diferencia también se puede cobrar contra entrega (la cobra el mensajero)
-- devoluciones_lista: datos del cliente para el rótulo, domicilio y estado de la garantía
-- garantias_pendientes: también cliente_telefono, direccion y barrio (para el rótulo)
-- (se cambiaron con replace sobre su definición, como en cambio_otro_producto.sql)
-- Garantías que ya existían: estado según lo que tenían (resuelta = entregada, con técnico = en arreglo, si no recibida)

-- ============================================================================
--  Envíos de cambios, garantías y devoluciones (YA APLICADO)
--  Cuando un mensajero va donde el cliente se crea un "envío": un pedido ya
--  alistado (sin productos ni vendedora, con servicio = tipo) que pasa por
--  Despachar (su QR), Mis entregas y el cuadre del mensajero como cualquiera.
--  total = lo que cobra el mensajero (el deducible contra entrega);
--  valor_domicilio = lo que se le paga (se descuenta en su cuadre y va a Gastos).
-- ============================================================================
alter table public.pedidos
  add column if not exists servicio text,
  add column if not exists servicio_detalle jsonb,
  add column if not exists devolucion_id bigint;
alter table public.devoluciones add column if not exists envio_pedido_id bigint;

create or replace function public.crear_envio_devolucion(p_devolucion bigint, p_domicilio numeric, p_cobrar numeric, p_detalle jsonb)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare d public.devoluciones; pe public.pedidos; v_id bigint; v_dom numeric := greatest(round(coalesce(p_domicilio, 0)), 0);
  v_cobrar numeric := greatest(round(coalesce(p_cobrar, 0)), 0); v_tipo text;
begin
  if not privado.puede_devoluciones() then raise exception 'Sin permiso'; end if;
  select * into d from public.devoluciones where id = p_devolucion for update;
  if not found then raise exception 'No existe'; end if;
  select * into pe from public.pedidos where id = d.pedido_id;
  v_tipo := case d.tipo when 'cambio' then 'cambio' when 'garantia' then 'garantía' else 'devolución' end;
  insert into public.pedidos (estado, alistado_at, cliente_nombre, cliente_telefono, direccion, barrio, observaciones, valor_domicilio, total,
                              canal, vendedora_id, stock_descontado, servicio, servicio_detalle, devolucion_id)
  values ('alistado', now(), pe.cliente_nombre, pe.cliente_telefono, pe.direccion, pe.barrio,
          left(initcap(v_tipo) || ' del pedido #' || pe.id || coalesce(' · ' || nullif(p_detalle->>'nota', ''), ''), 300),
          v_dom, v_cobrar, 'domicilio', null, true, d.tipo, coalesce(p_detalle, '{}'::jsonb), d.id)
  returning id into v_id;
  update public.devoluciones set envio_pedido_id = v_id, domicilio = domicilio + v_dom where id = d.id;
  if v_dom > 0 then
    insert into public.gastos (fecha, categoria, descripcion, valor, metodo, comprobantes, creado_por, creado_por_nombre)
    values ((now() at time zone 'America/Bogota')::date, 'transporte', 'Domicilio de ' || v_tipo || ' del pedido #' || pe.id || ' (envío #' || v_id || ')',
            v_dom, 'efectivo', '{}', public.mi_usuario_id(), public.mi_nombre());
  end if;
  perform public.nota(pe.id, 'Envío #' || v_id || ' para el ' || v_tipo
    || case when v_cobrar > 0 then ' · el mensajero cobra ' || privado.pesos(v_cobrar) else ' · sin cobro' end
    || case when v_dom > 0 then ' · domicilio ' || privado.pesos(v_dom) || ' lo paga el negocio' else '' end);
  perform public.nota(v_id, initcap(v_tipo) || ' del pedido #' || pe.id);
  return v_id;
end $function$;
revoke execute on function public.crear_envio_devolucion(bigint, numeric, numeric, jsonb) from public, anon;
grant execute on function public.crear_envio_devolucion(bigint, numeric, numeric, jsonb) to authenticated;
-- devoluciones_lista y garantias_pendientes devuelven también envio_pedido_id y envio_estado (y total/domicilio del envío)
