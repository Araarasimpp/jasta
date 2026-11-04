-- Eliminar deudas, compras y ajustes de inventario subidos por error (YA APLICADO 2026-11-04)

-- Deuda: se borra con sus abonos y productos
create or replace function public.eliminar_deuda(p_deuda bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  perform privado.solo_admin();
  delete from public.deuda_abonos where deuda_id = p_deuda;
  delete from public.deudas where id = p_deuda;
  if not found then raise exception 'Esa deuda no existe'; end if;
end $function$;

-- Compra: se restan las unidades que sumó (si no estaba anulada) y se borra con su historial y su deuda
create or replace function public.eliminar_compra(p_id bigint)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare c public.compras; v_deudas int;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede eliminar compras'; end if;
  select * into c from public.compras where id = p_id for update;
  if not found then raise exception 'Esa compra no existe'; end if;
  if not c.anulada then
    update public.productos pr set stock = pr.stock - i.cantidad, updated_at = now()
      from public.compra_items i where i.compra_id = p_id and i.producto_id = pr.id;
  end if;
  delete from public.deuda_abonos where deuda_id in (select id from public.deudas where compra_id = p_id);
  delete from public.deudas where compra_id = p_id;
  get diagnostics v_deudas = row_count;
  delete from public.inventario_movimientos where compra_id = p_id;
  delete from public.compra_items where compra_id = p_id;
  delete from public.compras where id = p_id;
  return jsonb_build_object('deudas', v_deudas);
end $function$;

-- Ajuste (conteo): se deshace la diferencia que hizo en el stock y se borra del historial
create or replace function public.eliminar_ajuste(p_mov bigint)
returns void language plpgsql security definer set search_path to '' as $function$
declare m public.inventario_movimientos;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede eliminar ajustes'; end if;
  select * into m from public.inventario_movimientos where id = p_mov for update;
  if not found then raise exception 'Ese ajuste no existe'; end if;
  if m.tipo <> 'ajuste' then raise exception 'Solo se pueden eliminar ajustes de conteo (las compras se eliminan desde Compras)'; end if;
  update public.productos set stock = greatest(stock - m.cantidad, 0), updated_at = now() where id = m.producto_id;
  delete from public.inventario_movimientos where id = p_mov;
end $function$;

revoke execute on function public.eliminar_deuda(bigint), public.eliminar_compra(bigint), public.eliminar_ajuste(bigint) from public, anon;
grant execute on function public.eliminar_deuda(bigint), public.eliminar_compra(bigint), public.eliminar_ajuste(bigint) to authenticated;

-- El historial del producto trae el id del movimiento (para poder eliminar un ajuste)
do $$
declare v text := pg_get_functiondef('public.movimientos_producto(bigint)'::regprocedure);
begin
  if position('''id'', m.id' in v) = 0 then
    v := replace(v, 'jsonb_build_object(''fecha'', m.created_at,', 'jsonb_build_object(''id'', m.id, ''fecha'', m.created_at,');
    if position('''id'', m.id' in v) = 0 then raise exception 'No se pudo cambiar movimientos_producto'; end if;
    execute v;
  end if;
end $$;
