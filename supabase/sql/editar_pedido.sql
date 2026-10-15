-- Jasta · Editar pedido
-- Pégalo en Supabase → SQL Editor (proyecto Jasta) y dale Run.
-- Cambia los datos y productos de un pedido. Admin puede editar cualquiera;
-- la vendedora solo los suyos que aún no se han alistado. Si el pedido ya
-- había descontado inventario, lo devuelve y lo vuelve a descontar.

create or replace function public.editar_pedido(
  p_pedido bigint, p_cliente_nombre text, p_cliente_telefono text, p_direccion text, p_barrio text,
  p_observaciones text, p_valor_domicilio numeric, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.pedidos; v_admin boolean := public.tiene_rol('admin'); it jsonb; pr record; v_precio numeric; v_sub numeric := 0; v_dom numeric;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not v_admin and not (p.vendedora_id = public.mi_usuario_id() and p.estado = 'por_alistar') then
    raise exception 'Solo puedes editar tus pedidos que aún no se han alistado';
  end if;
  if jsonb_array_length(coalesce(p_items,'[]')) = 0 then raise exception 'El pedido no tiene productos'; end if;
  if coalesce(trim(p_cliente_nombre),'') = '' then raise exception 'Falta el nombre del cliente'; end if;
  if p.stock_descontado then
    update public.productos x set stock = x.stock + i.cantidad from public.pedido_items i
     where i.pedido_id = p.id and i.producto_id = x.id and x.controla_stock;
  end if;
  delete from public.pedido_items where pedido_id = p.id;
  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint;
    if not found then raise exception 'Producto no encontrado'; end if;
    v_precio := coalesce((it->>'precio_venta')::numeric, pr.precio_venta);
    if v_precio < pr.precio_base and not v_admin then
      raise exception 'El precio de % no puede ser menor al precio base (%)', pr.nombre, pr.precio_base;
    end if;
    insert into public.pedido_items (pedido_id, producto_id, nombre, cantidad, precio_venta, precio_base, precio_compra, total)
    values (p.id, pr.id, pr.nombre, (it->>'cantidad')::int, v_precio, pr.precio_base, pr.precio_compra, v_precio * (it->>'cantidad')::int);
    v_sub := v_sub + v_precio * (it->>'cantidad')::int;
  end loop;
  if p.stock_descontado then
    update public.productos x set stock = x.stock - i.cantidad from public.pedido_items i
     where i.pedido_id = p.id and i.producto_id = x.id and x.controla_stock;
  end if;
  v_dom := case when p.canal = 'local' then 0 else coalesce(p_valor_domicilio, 0) end;
  update public.pedidos set cliente_nombre = trim(p_cliente_nombre), cliente_telefono = nullif(trim(p_cliente_telefono),''),
    direccion = nullif(trim(p_direccion),''), barrio = nullif(trim(p_barrio),''), observaciones = nullif(trim(p_observaciones),''),
    valor_domicilio = v_dom, total = v_sub + v_dom, updated_at = now(),
    valor_efectivo = case tipo_recaudo when 'efectivo' then v_sub + v_dom when 'mixto' then greatest(v_sub + v_dom - coalesce(valor_transferencia,0), 0) else valor_efectivo end,
    valor_transferencia = case tipo_recaudo when 'transferencia' then v_sub + v_dom else valor_transferencia end
  where id = p.id;
  perform public.nota(p.id, 'Pedido editado');
end $$;

revoke all on function public.editar_pedido(bigint,text,text,text,text,text,numeric,jsonb) from public, anon;
grant execute on function public.editar_pedido(bigint,text,text,text,text,text,numeric,jsonb) to authenticated;
