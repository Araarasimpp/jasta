-- PENDIENTE DE APLICAR (después de cuentas_por_cobrar.sql)
-- Las ventas del local marcadas "Venta al costo" (#100714 y #100715) pasan a Cuentas por cobrar, en la
-- cuenta "Mi hermano", con los mismos productos y precios. Se borran de las ventas del local sin tocar el
-- inventario (las unidades ya salieron y siguen fuera).
do $$
declare v_cuenta bigint; v_ent bigint; p record;
begin
  if not exists (select 1 from public.pedidos where observaciones ilike 'Venta al costo%' and canal = 'local') then return; end if;
  select id into v_cuenta from public.cuentas_cobrar where nombre = 'Mi hermano' limit 1;
  if v_cuenta is null then insert into public.cuentas_cobrar (nombre) values ('Mi hermano') returning id into v_cuenta; end if;
  for p in select * from public.pedidos where observaciones ilike 'Venta al costo%' and canal = 'local' order by id loop
    insert into public.cuenta_entregas (cuenta_id, fecha, total, nota, creado_por_nombre, created_at)
    values (v_cuenta, (p.created_at at time zone 'America/Bogota')::date, p.total,
            'Pasada desde Ventas del local (venta #' || p.id || ')', 'Admin', p.created_at)
    returning id into v_ent;
    insert into public.cuenta_entrega_items (entrega_id, producto_id, nombre, cantidad, costo)
    select v_ent, i.producto_id, i.nombre, i.cantidad, i.precio_venta from public.pedido_items i where i.pedido_id = p.id and i.producto_id is not null;
    delete from public.pedidos where id = p.id;
  end loop;
end $$;
