-- ============================================================================
--  Seguimiento del pedido (enlace para el cliente), cierre del día por Telegram
--  y compras/inventario · YA APLICADO en Supabase
-- ============================================================================

-- ---------------------------------------------------------------- Seguimiento
-- Cada pedido tiene un código imposible de adivinar; con él, cualquiera (sin sesión)
-- ve el estado, las fechas y lo que compró. Nada de costos ni datos de otros pedidos.
alter table public.pedidos add column if not exists seguimiento uuid not null default gen_random_uuid();
create unique index if not exists pedidos_seguimiento_idx on public.pedidos (seguimiento);

create or replace function public.seguimiento(p_codigo uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object(
    'id', p.id, 'estado', p.estado, 'creado_at', p.created_at, 'alistado_at', p.alistado_at,
    'en_ruta_at', case when p.estado in ('despachado', 'entregado') then p.asignado_at end,
    'entregado_at', p.entregado_at,
    'cliente', split_part(trim(p.cliente_nombre), ' ', 1), 'barrio', p.barrio,
    'total', p.total, 'domicilio', p.valor_domicilio,
    'mensajero', case when p.estado = 'despachado' then split_part(trim(m.nombre), ' ', 1) end,
    'novedad', case when p.estado not in ('entregado', 'cancelado') then p.ultima_novedad end,
    'novedad_at', case when p.estado not in ('entregado', 'cancelado') then p.novedad_at end,
    'vendedora', split_part(trim(v.nombre), ' ', 1), 'vendedora_telefono', v.telefono,
    'negocio', c.nombre_negocio, 'telefonos', c.telefonos,
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'color', i.color, 'talla', i.talla) order by i.id)
                        from public.pedido_items i where i.pedido_id = p.id), '[]'::jsonb))
  from public.pedidos p
  left join public.usuarios m on m.id = p.mensajero_id
  left join public.usuarios v on v.id = p.vendedora_id
  left join lateral (select nombre_negocio, telefonos from public.configuracion limit 1) c on true
  where p.seguimiento = p_codigo
$$;
grant execute on function public.seguimiento(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- Cierre del día
create or replace function privado.pesos(n numeric) returns text language sql immutable set search_path to '' as $$
  select case when n < 0 then '-' else '' end || '$' || replace(to_char(abs(round(coalesce(n, 0))), 'FM999,999,999,990'), ',', '.')
$$;

-- Resumen del día (hora Colombia) para mandarlo por Telegram
create or replace function privado.cierre_dia_texto(p_dia date)
returns text language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_dia::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_dia + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_ent int; v_ventas numeric; v_gan numeric; v_gastos numeric; v_nuevos int; v_canc int; v_nov int; v_nov_abiertas int;
  v_por_alistar int; v_alistados int; v_ruta int; v_cuadres numeric; v_cuadres_m int; v_comis numeric; v_top text;
begin
  select count(*), coalesce(sum(total - valor_domicilio), 0) into v_ent, v_ventas from public.pedidos where estado = 'entregado' and entregado_at >= d and entregado_at < h;
  select coalesce(sum((i.precio_base - i.precio_compra) * i.cantidad), 0) into v_gan
    from public.pedidos p join public.pedido_items i on i.pedido_id = p.id where p.estado = 'entregado' and p.created_at >= d and p.created_at < h;
  select coalesce(sum(valor), 0) into v_gastos from public.gastos where fecha = p_dia;
  select count(*) filter (where estado <> 'cancelado'), count(*) filter (where estado = 'cancelado') into v_nuevos, v_canc
    from public.pedidos where created_at >= d and created_at < h;
  select count(*) into v_nov from public.pedido_novedades where created_at >= d and created_at < h;
  select count(*) into v_nov_abiertas from public.pedidos where novedades > 0 and estado not in ('entregado', 'cancelado');
  select count(*) filter (where estado = 'por_alistar'), count(*) filter (where estado = 'alistado'), count(*) filter (where estado = 'despachado')
    into v_por_alistar, v_alistados, v_ruta from public.pedidos where estado in ('por_alistar', 'alistado', 'despachado');
  select coalesce(sum(coalesce(valor_efectivo, 0) - coalesce(valor_domicilio, 0)), 0), count(distinct mensajero_id) into v_cuadres, v_cuadres_m
    from public.pedidos where estado = 'entregado' and cuadre_id is null;
  select coalesce(sum(comision), 0) into v_comis from privado.por_liquidar(null);
  select u.nombre || ' (' || s.n || ')' into v_top from (
    select vendedora_id, count(*) n from public.pedidos where estado <> 'cancelado' and created_at >= d and created_at < h and vendedora_id is not null
    group by 1 order by 2 desc limit 1) s join public.usuarios u on u.id = s.vendedora_id;

  return '📊 Cierre del día · ' || to_char(p_dia, 'DD/MM/YYYY') || E'\n\n'
    || '✅ Entregados: ' || v_ent || ' · ' || privado.pesos(v_ventas) || E'\n'
    || '💰 Ganancia tienda: ' || privado.pesos(v_gan) || E'\n'
    || '🧾 Gastos: ' || privado.pesos(v_gastos) || E'\n'
    || '📈 Utilidad del día: ' || privado.pesos(v_gan - v_gastos) || E'\n\n'
    || '🆕 Pedidos nuevos: ' || v_nuevos || case when v_canc > 0 then ' · ❌ cancelados: ' || v_canc else '' end || E'\n'
    || coalesce('🏆 Más vendió: ' || v_top || E'\n', '')
    || '⚠️ Novedades hoy: ' || v_nov || case when v_nov_abiertas > 0 then ' · sin resolver: ' || v_nov_abiertas else '' end || E'\n\n'
    || '📦 Por alistar: ' || v_por_alistar || ' · Alistados: ' || v_alistados || ' · En ruta: ' || v_ruta || E'\n'
    || '💵 Por recibir en cuadres: ' || privado.pesos(v_cuadres) || case when v_cuadres_m > 0 then ' (' || v_cuadres_m || case when v_cuadres_m = 1 then ' mensajero)' else ' mensajeros)' end else '' end || E'\n'
    || '👛 Comisiones por pagar: ' || privado.pesos(v_comis);
end $function$;

-- Lo manda por Telegram (pg_net) a cada admin activo que tenga la cuenta vinculada con el bot
create or replace function privado.enviar_cierre_dia(p_dia date default null)
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_token text; v_texto text; r record; n int := 0;
begin
  select token into v_token from privado.telegram_config limit 1;
  if v_token is null then return 0; end if;
  v_texto := privado.cierre_dia_texto(coalesce(p_dia, (now() at time zone 'America/Bogota')::date));
  for r in select distinct t.telegram_id from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id
           where u.activo and 'admin' = any (u.roles) loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
                          body := jsonb_build_object('chat_id', r.telegram_id, 'text', v_texto),
                          headers := '{"Content-Type": "application/json"}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $function$;

-- Botón "Enviar ahora" (admin): manda el de hoy y devuelve el texto
create or replace function public.enviar_cierre_dia_ahora()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_dia date := (now() at time zone 'America/Bogota')::date;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return jsonb_build_object('enviados', privado.enviar_cierre_dia(v_dia), 'texto', privado.cierre_dia_texto(v_dia));
end $function$;
revoke execute on function public.enviar_cierre_dia_ahora() from public, anon;
grant execute on function public.enviar_cierre_dia_ahora() to authenticated;

create extension if not exists pg_cron;
-- 02:00 UTC = 9:00 p. m. en Colombia
select cron.schedule('cierre-del-dia', '0 2 * * *', $$select privado.enviar_cierre_dia()$$);

-- ---------------------------------------------------------------- Compras e inventario
alter table public.productos add column if not exists stock_minimo integer not null default 3;

create table if not exists public.compras (
  id bigint generated always as identity primary key,
  fecha date not null,
  proveedor text not null,
  nota text,
  total numeric not null default 0,
  comprobantes text[] not null default '{}',
  creado_por bigint references public.usuarios(id),
  creado_por_nombre text,
  created_at timestamptz not null default now(),
  anulada boolean not null default false
);
create table if not exists public.compra_items (
  id bigint generated always as identity primary key,
  compra_id bigint not null references public.compras(id),
  producto_id bigint not null references public.productos(id),
  nombre text not null,
  cantidad integer not null check (cantidad > 0),
  costo numeric not null check (costo >= 0)
);
create index if not exists compra_items_compra_idx on public.compra_items (compra_id);
create index if not exists compra_items_producto_idx on public.compra_items (producto_id);
create index if not exists compras_fecha_idx on public.compras (fecha desc);

-- Entradas y ajustes de inventario (las salidas por venta se leen de los pedidos entregados)
create table if not exists public.inventario_movimientos (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id),
  tipo text not null check (tipo in ('compra', 'ajuste', 'anulacion')),
  cantidad integer not null,
  stock_antes integer,
  stock_despues integer,
  motivo text,
  compra_id bigint references public.compras(id),
  autor text,
  created_at timestamptz not null default now()
);
create index if not exists inv_mov_producto_idx on public.inventario_movimientos (producto_id, created_at desc);

alter table public.compras enable row level security;
alter table public.compra_items enable row level security;
alter table public.inventario_movimientos enable row level security;
revoke all on public.compras, public.compra_items, public.inventario_movimientos from anon, authenticated;

create or replace function privado.puede_inventario() returns boolean language sql stable security definer set search_path to '' as $$
  select public.tiene_rol('admin') or public.tiene_rol('alistador')
$$;

-- Compra a proveedor: sube el stock y (si el admin lo pide) actualiza el costo del producto
create or replace function public.registrar_compra(p_fecha date, p_proveedor text, p_nota text, p_items jsonb, p_comprobantes text[], p_actualizar_costo boolean)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; it jsonb; pr public.productos; v_cant int; v_costo numeric; v_total numeric := 0; v_admin boolean := public.tiene_rol('admin'); v_antes int;
begin
  if not privado.puede_inventario() then raise exception 'No tienes permiso para registrar compras'; end if;
  if nullif(trim(coalesce(p_proveedor, '')), '') is null then raise exception 'Escribe el proveedor'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Agrega al menos un producto'; end if;
  insert into public.compras (fecha, proveedor, nota, comprobantes, creado_por, creado_por_nombre)
  values (coalesce(p_fecha, (now() at time zone 'America/Bogota')::date), left(trim(p_proveedor), 120), nullif(trim(coalesce(p_nota, '')), ''),
          privado.comprobantes_validos(p_comprobantes), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    v_cant := (it->>'cantidad')::int;
    -- Alistamiento no ve costos: lo que registra queda con el costo actual del producto
    v_costo := case when v_admin then coalesce((it->>'costo')::numeric, 0) end;
    if v_cant is null or v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    if v_costo < 0 then raise exception 'Costo inválido'; end if;
    select * into pr from public.productos where id = (it->>'producto_id')::bigint for update;
    if not found then raise exception 'Producto no encontrado'; end if;
    v_costo := coalesce(v_costo, pr.precio_compra, 0);
    -- Si el producto no llevaba inventario, arranca desde cero
    v_antes := case when pr.controla_stock then pr.stock else 0 end;
    insert into public.compra_items (compra_id, producto_id, nombre, cantidad, costo) values (v_id, pr.id, pr.nombre, v_cant, v_costo);
    update public.productos set stock = v_antes + v_cant, controla_stock = true, updated_at = now(),
      precio_compra = case when v_admin and p_actualizar_costo and v_costo > 0 then v_costo else precio_compra end
    where id = pr.id;
    insert into public.inventario_movimientos (producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, compra_id, autor)
    values (pr.id, 'compra', v_cant, v_antes, v_antes + v_cant, 'Compra a ' || left(trim(p_proveedor), 120), v_id, public.mi_nombre());
    v_total := v_total + v_cant * v_costo;
  end loop;
  update public.compras set total = v_total where id = v_id;
  return v_id;
end $function$;

create or replace function public.anular_compra(p_id bigint)
returns void language plpgsql security definer set search_path to '' as $function$
declare r record;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede anular compras'; end if;
  update public.compras set anulada = true where id = p_id and not anulada;
  if not found then raise exception 'La compra no existe o ya estaba anulada'; end if;
  for r in select i.producto_id, i.cantidad, p.stock from public.compra_items i join public.productos p on p.id = i.producto_id where i.compra_id = p_id loop
    update public.productos set stock = stock - r.cantidad, updated_at = now() where id = r.producto_id;
    insert into public.inventario_movimientos (producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, compra_id, autor)
    values (r.producto_id, 'anulacion', -r.cantidad, r.stock, r.stock - r.cantidad, 'Compra anulada', p_id, public.mi_nombre());
  end loop;
end $function$;

-- Conteo físico: el stock queda en lo que se contó y se guarda la diferencia
create or replace function public.ajustar_stock(p_producto bigint, p_contado integer, p_motivo text)
returns void language plpgsql security definer set search_path to '' as $function$
declare pr public.productos; v_antes int;
begin
  if not privado.puede_inventario() then raise exception 'No tienes permiso para ajustar el inventario'; end if;
  if p_contado is null or p_contado < 0 then raise exception 'Escribe cuántos hay'; end if;
  select * into pr from public.productos where id = p_producto for update;
  if not found then raise exception 'Producto no encontrado'; end if;
  v_antes := case when pr.controla_stock then pr.stock else 0 end;
  if pr.controla_stock and pr.stock = p_contado then return; end if;
  update public.productos set stock = p_contado, controla_stock = true, updated_at = now() where id = pr.id;
  insert into public.inventario_movimientos (producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, autor)
  values (pr.id, 'ajuste', p_contado - v_antes, v_antes, p_contado,
          coalesce(nullif(trim(coalesce(p_motivo, '')), ''), case when pr.controla_stock then 'Conteo' else 'Conteo inicial' end), public.mi_nombre());
end $function$;

create or replace function public.guardar_stock_minimo(p_producto bigint, p_minimo integer)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not privado.puede_inventario() then raise exception 'Sin permiso'; end if;
  update public.productos set stock_minimo = greatest(coalesce(p_minimo, 0), 0) where id = p_producto;
end $function$;

-- Dejar de llevar inventario de un producto (vuelve a "sin control")
create or replace function public.quitar_control_stock(p_producto bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not privado.puede_inventario() then raise exception 'Sin permiso'; end if;
  update public.productos set controla_stock = false, updated_at = now() where id = p_producto;
end $function$;

-- Lista de inventario: stock, mínimo, lo vendido en 30 días y (solo admin) el costo
create or replace function public.inventario()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_admin boolean := public.tiene_rol('admin');
begin
  if not privado.puede_inventario() then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'nombre', p.nombre, 'sku', p.sku, 'imagen_url', p.imagen_url, 'stock', p.stock, 'stock_minimo', p.stock_minimo,
      'controla_stock', p.controla_stock, 'costo', case when v_admin then p.precio_compra end,
      'vendidos_30', coalesce(v.n, 0)) order by p.nombre), '[]'::jsonb)
    from public.productos p
    left join (select i.producto_id, sum(i.cantidad) n from public.pedido_items i join public.pedidos pe on pe.id = i.pedido_id
               where pe.estado = 'entregado' and pe.entregado_at >= now() - interval '30 days' group by 1) v on v.producto_id = p.id
    where p.activo);
end $function$;

-- Historial de un producto: compras, ajustes y ventas entregadas (lo más reciente primero)
create or replace function public.movimientos_producto(p_producto bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not privado.puede_inventario() then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(x order by x->>'fecha' desc), '[]'::jsonb) from (
    (select jsonb_build_object('fecha', m.created_at, 'tipo', m.tipo, 'cantidad', m.cantidad, 'detalle', m.motivo, 'autor', m.autor, 'stock_despues', m.stock_despues) x
       from public.inventario_movimientos m where m.producto_id = p_producto order by m.created_at desc limit 60)
    union all
    (select jsonb_build_object('fecha', pe.entregado_at, 'tipo', 'venta', 'cantidad', -i.cantidad, 'detalle', 'Pedido #' || pe.id || ' · ' || pe.cliente_nombre, 'autor', null, 'stock_despues', null)
       from public.pedido_items i join public.pedidos pe on pe.id = i.pedido_id
      where i.producto_id = p_producto and pe.estado = 'entregado' order by pe.entregado_at desc limit 60)) s);
end $function$;

create or replace function public.compras_lista(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_admin boolean := public.tiene_rol('admin');
begin
  if not privado.puede_inventario() then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'fecha', c.fecha, 'proveedor', c.proveedor, 'nota', c.nota,
      'total', case when v_admin then c.total end, 'comprobantes', c.comprobantes, 'creado_por_nombre', c.creado_por_nombre,
      'created_at', c.created_at, 'anulada', c.anulada,
      'items', (select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'costo', case when v_admin then i.costo end) order by i.id)
                from public.compra_items i where i.compra_id = c.id)) order by c.fecha desc, c.id desc), '[]'::jsonb)
    from public.compras c where c.fecha between p_desde and p_hasta);
end $function$;

revoke execute on function public.registrar_compra(date, text, text, jsonb, text[], boolean), public.anular_compra(bigint), public.ajustar_stock(bigint, integer, text),
  public.guardar_stock_minimo(bigint, integer), public.quitar_control_stock(bigint), public.inventario(), public.movimientos_producto(bigint),
  public.compras_lista(date, date) from public, anon;
grant execute on function public.registrar_compra(date, text, text, jsonb, text[], boolean), public.anular_compra(bigint), public.ajustar_stock(bigint, integer, text),
  public.guardar_stock_minimo(bigint, integer), public.quitar_control_stock(bigint), public.inventario(), public.movimientos_producto(bigint),
  public.compras_lista(date, date) to authenticated;
