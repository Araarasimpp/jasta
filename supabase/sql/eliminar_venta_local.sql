-- Eliminar una venta del local: solo el admin. Devuelve el stock si la venta lo había
-- descontado; los productos, notas y mensajes de la venta se borran con ella (cascada).
-- Ya aplicado en Supabase; respaldo.
create or replace function public.eliminar_venta_local(p_pedido bigint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare p public.pedidos;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede eliminar ventas del local'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if p.canal <> 'local' then raise exception 'El pedido #% no es una venta del local', p_pedido; end if;
  if p.estado = 'entregado' and p.stock_descontado then
    update public.productos pr set stock = pr.stock + i.cantidad, updated_at = now()
      from public.pedido_items i where i.pedido_id = p.id and i.producto_id = pr.id and pr.controla_stock;
  end if;
  delete from public.pedidos where id = p_pedido;
end $$;
revoke execute on function public.eliminar_venta_local(bigint) from public, anon;
grant execute on function public.eliminar_venta_local(bigint) to authenticated;
