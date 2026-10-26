-- ============================================================================
--  Devoluciones y garantías + rentabilidad por producto · YA APLICADO en Supabase
--
--  Una devolución sale de un pedido entregado: qué productos y cuántos, el tipo
--  (devolución con reembolso, cambio o garantía), el motivo y qué pasa con el
--  producto que regresa (vuelve al inventario o se daña) y si se entrega otro.
--  · Inventario: +unidades si vuelve en buen estado, −unidades si se entrega otro
--    (solo en productos que llevan inventario).
--  · Comisión: en una devolución con reembolso se le descuenta a la vendedora su
--    ganancia de esas unidades; el descuento entra en su próxima liquidación.
-- ============================================================================

create table if not exists public.devoluciones (
  id bigint generated always as identity primary key,
  pedido_id bigint not null references public.pedidos(id),
  tipo text not null check (tipo in ('devolucion', 'cambio', 'garantia')),
  motivo text not null check (motivo in ('defectuoso', 'llego_danado', 'no_le_gusto', 'talla_color', 'incompleto', 'otro')),
  estado_producto text not null check (estado_producto in ('vuelve_stock', 'danado')),
  reemplazo boolean not null default false,
  reembolso numeric not null default 0 check (reembolso >= 0),
  metodo text check (metodo in ('efectivo', 'transferencia', 'otro')),
  comision_descuento numeric not null default 0,
  nota text,
  fotos text[] not null default '{}',
  liquidacion_id bigint references public.liquidaciones(id),
  creado_por bigint references public.usuarios(id),
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
create table if not exists public.devolucion_items (
  id bigint generated always as identity primary key,
  devolucion_id bigint not null references public.devoluciones(id),
  item_id bigint not null references public.pedido_items(id),
  producto_id bigint references public.productos(id),
  nombre text not null,
  cantidad integer not null check (cantidad > 0),
  precio_venta numeric not null default 0,
  precio_base numeric not null default 0,
  precio_compra numeric not null default 0
);
create index if not exists devoluciones_pedido_idx on public.devoluciones (pedido_id);
create index if not exists devoluciones_fecha_idx on public.devoluciones (created_at desc);
create index if not exists devolucion_items_dev_idx on public.devolucion_items (devolucion_id);
create index if not exists devolucion_items_item_idx on public.devolucion_items (item_id);
create index if not exists devolucion_items_prod_idx on public.devolucion_items (producto_id);
alter table public.devoluciones enable row level security;
alter table public.devolucion_items enable row level security;
revoke all on public.devoluciones, public.devolucion_items from anon, authenticated;

create or replace function privado.puede_devoluciones() returns boolean language sql stable security definer set search_path to '' as $$
  select public.tiene_rol('admin') or public.tiene_rol('alistador') or public.tiene_rol('venta_local') or public.tiene_rol('cuadres')
$$;

create or replace function privado.motivo_devolucion(p text) returns text language sql immutable set search_path to '' as $$
  select case p when 'defectuoso' then 'Salió defectuoso' when 'llego_danado' then 'Llegó dañado' when 'no_le_gusto' then 'No le gustó'
    when 'talla_color' then 'Talla o color' when 'incompleto' then 'Llegó incompleto' else 'Otro motivo' end
$$;

-- p_items: [{item_id, cantidad}]
create or replace function public.registrar_devolucion(p_pedido bigint, p_items jsonb, p_tipo text, p_motivo text, p_estado_producto text,
  p_reemplazo boolean, p_reembolso numeric, p_metodo text, p_descontar_comision boolean, p_nota text, p_fotos text[])
returns bigint language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_id bigint; it jsonb; i public.pedido_items; v_cant int; v_ya int; pr public.productos; v_com numeric := 0; v_n int := 0; v_txt text := '';
begin
  if not privado.puede_devoluciones() then raise exception 'No tienes permiso para registrar devoluciones'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado <> 'entregado' then raise exception 'Solo se registran devoluciones de pedidos entregados'; end if;
  if p_tipo not in ('devolucion', 'cambio', 'garantia') then raise exception 'Tipo inválido'; end if;
  if p_estado_producto not in ('vuelve_stock', 'danado') then raise exception 'Estado del producto inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Elige qué productos devuelve'; end if;
  if p_tipo = 'devolucion' and coalesce(p_reembolso, 0) > p.total then raise exception 'El reembolso no puede ser mayor que el pedido'; end if;

  insert into public.devoluciones (pedido_id, tipo, motivo, estado_producto, reemplazo, reembolso, metodo, nota, fotos, creado_por, creado_por_nombre)
  values (p.id, p_tipo, coalesce(p_motivo, 'otro'), p_estado_producto, p_tipo <> 'devolucion' and coalesce(p_reemplazo, false),
          case when p_tipo = 'devolucion' then coalesce(p_reembolso, 0) else 0 end,
          case when p_tipo = 'devolucion' and coalesce(p_reembolso, 0) > 0 then coalesce(p_metodo, 'efectivo') end,
          nullif(trim(coalesce(p_nota, '')), ''), privado.comprobantes_validos(p_fotos), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::int;
    if v_cant is null or v_cant <= 0 then continue; end if;
    select * into i from public.pedido_items where id = (it->>'item_id')::bigint and pedido_id = p.id;
    if not found then raise exception 'Ese producto no es de este pedido'; end if;
    select coalesce(sum(di.cantidad), 0) into v_ya from public.devolucion_items di join public.devoluciones d on d.id = di.devolucion_id
      where di.item_id = i.id and d.tipo = 'devolucion';
    if p_tipo = 'devolucion' and v_ya + v_cant > i.cantidad then raise exception 'De % ya se devolvieron % de %', i.nombre, v_ya, i.cantidad; end if;
    if v_cant > i.cantidad then raise exception 'De % solo se vendieron %', i.nombre, i.cantidad; end if;
    insert into public.devolucion_items (devolucion_id, item_id, producto_id, nombre, cantidad, precio_venta, precio_base, precio_compra)
    values (v_id, i.id, i.producto_id, i.nombre, v_cant, coalesce(i.precio_venta, 0), coalesce(i.precio_base, 0), coalesce(i.precio_compra, 0));
    v_com := v_com + (coalesce(i.precio_venta, 0) - coalesce(i.precio_base, 0)) * v_cant;
    v_n := v_n + v_cant;
    v_txt := v_txt || case when v_txt = '' then '' else ', ' end || v_cant || ' ' || i.nombre;

    -- Inventario (solo si el producto lo lleva)
    if i.producto_id is not null then
      select * into pr from public.productos where id = i.producto_id for update;
      if found and pr.controla_stock then
        if p_estado_producto = 'vuelve_stock' then
          update public.productos set stock = stock + v_cant, updated_at = now() where id = pr.id;
          insert into public.inventario_movimientos (producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, autor)
          values (pr.id, 'ajuste', v_cant, pr.stock, pr.stock + v_cant, 'Devolución del pedido #' || p.id, public.mi_nombre());
          pr.stock := pr.stock + v_cant;
        end if;
        if p_tipo <> 'devolucion' and coalesce(p_reemplazo, false) then
          update public.productos set stock = stock - v_cant, updated_at = now() where id = pr.id;
          insert into public.inventario_movimientos (producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, autor)
          values (pr.id, 'ajuste', -v_cant, pr.stock, pr.stock - v_cant, 'Reemplazo por ' || p_tipo || ' del pedido #' || p.id, public.mi_nombre());
        end if;
      end if;
    end if;
  end loop;
  if v_n = 0 then raise exception 'Escribe cuántas unidades devuelve'; end if;

  -- Comisión: solo en devolución con reembolso y si se pidió descontarla
  if p_tipo = 'devolucion' and coalesce(p_descontar_comision, true) and v_com > 0 and p.vendedora_id is not null then
    update public.devoluciones set comision_descuento = v_com where id = v_id;
    perform privado.avisar(array[p.vendedora_id], 'devolucion', 'Devolución en el pedido #' || p.id,
      v_txt || ' · se descuentan ' || privado.pesos(v_com) || ' de tu comisión', '/app/comisiones', p.id);
  end if;

  perform public.nota(p.id, case p_tipo when 'devolucion' then 'Devolución' when 'cambio' then 'Cambio' else 'Garantía' end || ': ' || v_txt
    || ' · ' || privado.motivo_devolucion(p_motivo)
    || case when p_estado_producto = 'vuelve_stock' then ' · vuelve al inventario' else ' · producto dañado' end
    || case when p_tipo = 'devolucion' and coalesce(p_reembolso, 0) > 0 then ' · reembolso ' || privado.pesos(p_reembolso) else '' end
    || case when p_tipo <> 'devolucion' and coalesce(p_reemplazo, false) then ' · se entregó otro' else '' end);
  return v_id;
end $function$;

-- Lista del periodo con resumen
create or replace function public.devoluciones_lista(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_admin boolean := public.tiene_rol('admin');
begin
  if not privado.puede_devoluciones() then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'lista', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', dv.id, 'pedido_id', dv.pedido_id, 'cliente', pe.cliente_nombre, 'vendedora', v.nombre, 'tipo', dv.tipo,
        'motivo', privado.motivo_devolucion(dv.motivo), 'estado_producto', dv.estado_producto, 'reemplazo', dv.reemplazo,
        'reembolso', dv.reembolso, 'metodo', dv.metodo, 'comision_descuento', dv.comision_descuento, 'nota', dv.nota, 'fotos', dv.fotos,
        'creado_por_nombre', dv.creado_por_nombre, 'fecha', dv.created_at,
        'perdida', case when v_admin then (select coalesce(sum(case when dv.estado_producto = 'danado' then di.precio_compra * di.cantidad else 0 end), 0)
                                            from public.devolucion_items di where di.devolucion_id = dv.id) end,
        'items', (select jsonb_agg(jsonb_build_object('nombre', di.nombre, 'cantidad', di.cantidad) order by di.id) from public.devolucion_items di where di.devolucion_id = dv.id))
        order by dv.created_at desc), '[]'::jsonb)
      from public.devoluciones dv join public.pedidos pe on pe.id = dv.pedido_id left join public.usuarios v on v.id = pe.vendedora_id
      where dv.created_at >= d and dv.created_at < h),
    'por_motivo', (select coalesce(jsonb_agg(jsonb_build_object('motivo', privado.motivo_devolucion(motivo), 'n', n) order by n desc), '[]'::jsonb)
      from (select motivo, count(*) n from public.devoluciones where created_at >= d and created_at < h group by 1) s)
  );
end $function$;

-- Lo que ya se devolvió de cada producto de un pedido (para el formulario)
create or replace function public.devoluciones_pedido(p_pedido bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not privado.puede_devoluciones() then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_object_agg(item_id::text, n), '{}'::jsonb) from (
    select di.item_id, sum(di.cantidad) n from public.devolucion_items di join public.devoluciones d on d.id = di.devolucion_id
    where d.pedido_id = p_pedido and d.tipo = 'devolucion' group by 1) s);
end $function$;

revoke execute on function public.registrar_devolucion(bigint, jsonb, text, text, text, boolean, numeric, text, boolean, text, text[]),
  public.devoluciones_lista(date, date), public.devoluciones_pedido(bigint) from public, anon;
grant execute on function public.registrar_devolucion(bigint, jsonb, text, text, text, boolean, numeric, text, boolean, text, text[]),
  public.devoluciones_lista(date, date), public.devoluciones_pedido(bigint) to authenticated;

-- ---------------------------------------------------------------- Comisiones: descuentos por devolución
-- Líneas negativas que entran en la próxima liquidación de la vendedora
create or replace function privado.descuentos_por_liquidar(p_vendedora bigint)
returns table(devolucion_id bigint, pedido_id bigint, vendedora_id bigint, dia date, comision numeric, nombre text)
language sql stable security definer set search_path to '' as $$
  select d.id, d.pedido_id, p.vendedora_id, (d.created_at at time zone 'America/Bogota')::date, -d.comision_descuento,
         'Devolución · ' || coalesce((select string_agg(di.cantidad || ' ' || di.nombre, ', ') from public.devolucion_items di where di.devolucion_id = d.id), '')
  from public.devoluciones d join public.pedidos p on p.id = d.pedido_id
  where d.comision_descuento > 0 and d.liquidacion_id is null and p.vendedora_id is not null
    and (p_vendedora is null or p.vendedora_id = p_vendedora)
$$;

create or replace function public.liquidaciones_pendientes()
returns table(vendedora_id bigint, nombre text, pedidos bigint, total numeric, desde date, hasta date)
language plpgsql stable security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id(); v_v bigint;
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  v_v := case when public.tiene_rol('admin') then null else v_yo end;
  return query
    select x.vendedora_id, u.nombre, count(*) filter (where x.es_pedido), sum(x.comision), min(x.dia), max(x.dia)
    from (select l.vendedora_id, l.dia, l.comision, true es_pedido from privado.por_liquidar(v_v) l
          union all
          select dl.vendedora_id, dl.dia, dl.comision, false from privado.descuentos_por_liquidar(v_v) dl) x
    join public.usuarios u on u.id = x.vendedora_id
    group by 1, 2 order by 4 desc;
end $function$;

create or replace function public.liquidacion_pedidos(p_vendedora bigint, p_liquidacion bigint)
returns table(id bigint, dia date, cliente_nombre text, total numeric, comision numeric)
language plpgsql stable security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null or not (public.tiene_rol('admin') or p_vendedora = v_yo) then raise exception 'Sin permiso'; end if;
  if p_liquidacion is null then
    return query
      select x.id, x.dia, x.cliente_nombre, x.total, x.comision from (
        select l.id, l.dia, l.cliente_nombre, l.total, l.comision from privado.por_liquidar(p_vendedora) l
        union all
        select dl.pedido_id, dl.dia, dl.nombre, 0::numeric, dl.comision from privado.descuentos_por_liquidar(p_vendedora) dl) x
      order by 2, 1;
  else
    return query
      select x.id, x.dia, x.cliente_nombre, x.total, x.comision from (
        select p.id, (coalesce(p.entregado_at, p.created_at) at time zone 'America/Bogota')::date dia, p.cliente_nombre, p.total, privado.comision(p.id) comision
          from public.pedidos p where p.liquidacion_id = p_liquidacion and p.vendedora_id = p_vendedora
        union all
        select d.pedido_id, (d.created_at at time zone 'America/Bogota')::date, 'Devolución', 0::numeric, -d.comision_descuento
          from public.devoluciones d where d.liquidacion_id = p_liquidacion) x
      order by 2, 1;
  end if;
end $function$;

create or replace function public.pagar_liquidacion(p_vendedora bigint, p_hasta date, p_metodo text, p_comprobantes text[], p_nota text)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_ev text[]; v_n int; v_total numeric; v_desc numeric; v_desde date; v_hasta date;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin registra pagos a vendedoras'; end if;
  if p_metodo not in ('efectivo', 'transferencia', 'otro') then raise exception 'Forma de pago inválida'; end if;
  v_ev := privado.comprobantes_validos(p_comprobantes);
  select count(*), coalesce(sum(comision), 0), min(dia), max(dia) into v_n, v_total, v_desde, v_hasta
    from privado.por_liquidar(p_vendedora) where dia <= p_hasta;
  select coalesce(sum(comision), 0) into v_desc from privado.descuentos_por_liquidar(p_vendedora) where dia <= p_hasta;
  if v_n = 0 and v_desc = 0 then raise exception 'No hay comisiones pendientes hasta ese día'; end if;
  insert into public.liquidaciones (vendedora_id, desde, hasta, cantidad_pedidos, total, metodo, comprobantes, nota, pagado_por, pagado_por_nombre)
  values (p_vendedora, v_desde, v_hasta, v_n, v_total + v_desc, p_metodo, v_ev, nullif(trim(coalesce(p_nota, '')), ''), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  update public.pedidos set liquidacion_id = v_id where id in (select id from privado.por_liquidar(p_vendedora) where dia <= p_hasta);
  update public.devoluciones set liquidacion_id = v_id where id in (select devolucion_id from privado.descuentos_por_liquidar(p_vendedora) where dia <= p_hasta);
  perform privado.avisar(array[p_vendedora], 'liquidacion', 'Te pagaron tus comisiones',
    privado.pesos(v_total + v_desc) || ' · ' || v_n || ' pedidos · ' || p_metodo, '/app/comisiones', null);
  return v_id;
end $function$;

create or replace function public.anular_liquidacion(p_id bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede anular un pago'; end if;
  update public.liquidaciones set anulada = true where id = p_id and not anulada;
  if not found then raise exception 'El pago no existe o ya estaba anulado'; end if;
  update public.pedidos set liquidacion_id = null where liquidacion_id = p_id;
  update public.devoluciones set liquidacion_id = null where liquidacion_id = p_id;
end $function$;

-- ---------------------------------------------------------------- Rentabilidad por producto
-- Por producto, en los pedidos entregados del periodo (por fecha de entrega):
-- unidades, ventas, ganancia de la tienda y de las vendedoras, y lo que restan las
-- devoluciones del periodo (ganancia perdida por reembolsos + costo de lo dañado).
create or replace function public.rentabilidad(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'ganancia_neta')::numeric desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'producto_id', k.producto_id, 'nombre', k.nombre, 'imagen_url', pr.imagen_url, 'activo', coalesce(pr.activo, false),
      'unidades', coalesce(v.unidades, 0), 'pedidos', coalesce(v.pedidos, 0),
      'ventas', coalesce(v.ventas, 0), 'ganancia_tienda', coalesce(v.gan_tienda, 0), 'ganancia_vendedoras', coalesce(v.gan_vend, 0),
      'costo', coalesce(v.costo, 0),
      'devueltas', coalesce(r.devueltas, 0), 'reembolsos', coalesce(r.reembolsos, 0), 'perdidas', coalesce(r.perdidas, 0),
      'novedades', coalesce(v.novedades, 0),
      'ganancia_neta', coalesce(v.gan_tienda, 0) - coalesce(r.perdidas, 0)) x
    from (
      select coalesce(i.producto_id::text, 'n:' || lower(i.nombre)) k, max(i.producto_id) producto_id, max(i.nombre) nombre
      from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
      where p.estado = 'entregado' and p.entregado_at >= d and p.entregado_at < h group by 1
      union
      select coalesce(di.producto_id::text, 'n:' || lower(di.nombre)), max(di.producto_id), max(di.nombre)
      from public.devolucion_items di join public.devoluciones dv on dv.id = di.devolucion_id
      where dv.created_at >= d and dv.created_at < h group by 1
    ) k
    left join public.productos pr on pr.id = k.producto_id
    left join (
      select coalesce(i.producto_id::text, 'n:' || lower(i.nombre)) k, sum(i.cantidad) unidades, count(distinct p.id) pedidos,
        sum(i.precio_venta * i.cantidad) ventas, sum((i.precio_base - i.precio_compra) * i.cantidad) gan_tienda,
        sum((i.precio_venta - i.precio_base) * i.cantidad) gan_vend, sum(i.precio_compra * i.cantidad) costo,
        count(distinct p.id) filter (where p.novedades > 0) novedades
      from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
      where p.estado = 'entregado' and p.entregado_at >= d and p.entregado_at < h group by 1
    ) v on v.k = k.k
    left join (
      select coalesce(di.producto_id::text, 'n:' || lower(di.nombre)) k,
        sum(di.cantidad) filter (where dv.tipo = 'devolucion') devueltas,
        sum(case when dv.tipo = 'devolucion' then di.precio_venta * di.cantidad else 0 end) reembolsos,
        -- Pérdida: la ganancia de la tienda que se devolvió + lo que costó lo que se dañó
        sum(case when dv.tipo = 'devolucion' then (di.precio_base - di.precio_compra) * di.cantidad else 0 end
          + case when dv.estado_producto = 'danado' then di.precio_compra * di.cantidad else 0 end) perdidas
      from public.devolucion_items di join public.devoluciones dv on dv.id = di.devolucion_id
      where dv.created_at >= d and dv.created_at < h group by 1
    ) r on r.k = k.k
  ) s);
end $function$;
revoke execute on function public.rentabilidad(date, date) from public, anon;
grant execute on function public.rentabilidad(date, date) to authenticated;

-- El cierre del día también resta los descuentos por devolución en "comisiones por pagar"
do $$ begin
  execute replace(pg_get_functiondef('privado.cierre_dia_texto(date)'::regprocedure),
    'select coalesce(sum(comision), 0) into v_comis from privado.por_liquidar(null);',
    'select coalesce(sum(comision), 0) into v_comis from (select comision from privado.por_liquidar(null) union all select comision from privado.descuentos_por_liquidar(null)) z;');
end $$;
