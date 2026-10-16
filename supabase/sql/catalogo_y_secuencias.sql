-- 1) Números de la app separados de los que llegan de WordPress.
--    La sincronización con WordPress mete pedidos, líneas, notas y productos
--    con sus propios números (id). Los contadores de la app se habían quedado
--    atrás y al crear un pedido chocaban ("duplicate key ... pedido_notas_pkey").
--    Ahora lo que crea la app arranca en un rango que WordPress no alcanza.
-- 2) Descripción de los productos, para el catálogo (se trajeron las 37 que
--    tenía la tienda web; el resto se escribe en Productos → editar).
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

select setval('public.pedidos_id_seq', greatest(100000, (select max(id) from public.pedidos)));
select setval('public.productos_id_seq', greatest(100000, (select max(id) from public.productos)));
select setval('public.pedido_items_id_seq', greatest(1000000, (select max(id) from public.pedido_items)));
select setval('public.pedido_notas_id_seq', greatest(1000000, (select max(id) from public.pedido_notas)));
select setval('public.usuarios_id_seq', greatest(10000, (select max(id) from public.usuarios)));
select setval('public.cuadres_id_seq', greatest(100000, (select max(id) from public.cuadres)));

alter table public.productos add column if not exists descripcion text;
