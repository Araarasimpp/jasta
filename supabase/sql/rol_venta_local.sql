-- Rol "venta_local": quien registra las ventas en el local.
--  · Solo ese rol (y admin) registra ventas en el local y ve "Ventas del local".
--  · Al registrar se elige la vendedora: la venta queda a su nombre
--    (vendedora_id), así su ganancia (precio de venta − base) suma en
--    Reportes y en el Ranking, y le llega el aviso de la venta.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

alter type public.rol add value if not exists 'venta_local';

create or replace function public.registrar_venta_local(
  p_cliente_nombre text, p_cliente_telefono text, p_observaciones text, p_items jsonb,
  p_tipo text, p_efectivo numeric, p_transferencia numeric, p_vendedora bigint default null)
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare
  v_yo bigint := public.mi_usuario_id();
  v_admin boolean := public.tiene_rol('admin');
  v_id bigint; v_sub numeric := 0; v_gan numeric := 0; it jsonb; pr record; v_precio numeric; v_cant int;
  v_vend_nombre text; v_yo_nombre text := public.mi_nombre();
begin
  if not (v_admin or public.tiene_rol('venta_local')) then raise exception 'Solo el rol Venta local registra ventas en el local'; end if;
  if p_tipo not in ('efectivo', 'transferencia', 'mixto') then raise exception 'Forma de pago inválida'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'La venta no tiene productos'; end if;
  if p_vendedora is not null then
    select nombre into v_vend_nombre from public.usuarios where id = p_vendedora and activo and 'vendedora' = any(roles);
    if v_vend_nombre is null then raise exception 'Esa vendedora no existe o está inactiva'; end if;
  end if;

  insert into public.pedidos (estado, canal, vendedora_id, cliente_nombre, cliente_telefono, observaciones, valor_domicilio)
  values ('entregado', 'local', p_vendedora, coalesce(nullif(trim(p_cliente_nombre), ''), 'Cliente del local'),
          nullif(trim(p_cliente_telefono), ''), nullif(trim(p_observaciones), ''), 0)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint and activo;
    if not found then raise exception 'Producto no disponible'; end if;
    v_cant := (it->>'cantidad')::int;
    if v_cant is null or v_cant < 1 then raise exception 'Cantidad inválida'; end if;
    v_precio := coalesce((it->>'precio_venta')::numeric, pr.precio_venta);
    -- La ganancia de la vendedora es venta − base: no puede quedar negativa
    if v_precio < pr.precio_base and not v_admin then
      raise exception 'El precio de % no puede ser menor al precio base (%)', pr.nombre, pr.precio_base;
    end if;
    insert into public.pedido_items (pedido_id, producto_id, nombre, cantidad, precio_venta, precio_base, precio_compra, total)
    values (v_id, pr.id, pr.nombre, v_cant, v_precio, pr.precio_base, pr.precio_compra, v_precio * v_cant);
    v_sub := v_sub + v_precio * v_cant;
    v_gan := v_gan + (v_precio - pr.precio_base) * v_cant;
  end loop;

  if p_tipo = 'efectivo' then p_efectivo := v_sub; p_transferencia := 0;
  elsif p_tipo = 'transferencia' then p_efectivo := 0; p_transferencia := v_sub;
  elsif coalesce(p_efectivo, 0) + coalesce(p_transferencia, 0) <> v_sub then raise exception 'Efectivo + transferencia debe sumar %', v_sub;
  end if;

  update public.pedidos set total = v_sub, entregado_at = now(), tipo_recaudo = p_tipo,
    valor_efectivo = p_efectivo, valor_transferencia = p_transferencia, stock_descontado = true
  where id = v_id;
  update public.productos x set stock = x.stock - i.cantidad, updated_at = now()
    from public.pedido_items i where i.pedido_id = v_id and i.producto_id = x.id and x.controla_stock;

  insert into public.pedido_notas (pedido_id, autor, nota) values (v_id, v_yo_nombre,
    'Venta en el local · ' || p_tipo || coalesce(' · vendedora: ' || v_vend_nombre, ' · sin vendedora'));

  if p_vendedora is not null then
    perform privado.avisar(array[p_vendedora], 'venta_local',
      'Venta en el local #' || v_id || ' a tu nombre',
      coalesce(nullif(trim(p_cliente_nombre), ''), 'Cliente del local') || ' · ' || '$' || replace(to_char(v_sub, 'FM999G999G999'), ',', '.') || ' · tu ganancia ' || '$' || replace(to_char(v_gan, 'FM999G999G999'), ',', '.'),
      '/app/pedidos?id=' || v_id, v_id);
  end if;
  return v_id;
end $fn$;

-- La función vieja queda como puerta a la nueva (mismas reglas, sin vendedora)
create or replace function public.crear_venta_local(p_cliente_nombre text, p_cliente_telefono text, p_observaciones text, p_items jsonb, p_tipo text, p_efectivo numeric, p_transferencia numeric)
returns bigint language sql security definer set search_path = '' as $fn$
  select public.registrar_venta_local(p_cliente_nombre, p_cliente_telefono, p_observaciones, p_items, p_tipo, p_efectivo, p_transferencia, null)
$fn$;

revoke all on function public.registrar_venta_local(text, text, text, jsonb, text, numeric, numeric, bigint) from public, anon;
grant execute on function public.registrar_venta_local(text, text, text, jsonb, text, numeric, numeric, bigint) to authenticated;

-- Quien tiene el rol ve todas las ventas del local (para "Ventas del local")
alter policy pedidos_ver on public.pedidos using (
  (select public.tiene_rol('admin')) or (select public.tiene_rol('alistador')) or (select public.tiene_rol('cuadres'))
  or vendedora_id = (select public.mi_usuario_id()) or mensajero_id = (select public.mi_usuario_id())
  or (canal = 'local' and (select public.tiene_rol('venta_local')))
);
