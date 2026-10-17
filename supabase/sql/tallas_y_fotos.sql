-- Tallas y fotos adicionales por producto; color y talla en cada línea del pedido.
--  · productos.imagenes: fotos aparte de la principal y de los colores (máx. 12)
--  · productos.tallas: tallas disponibles (vacío = no maneja tallas, máx. 40)
--  · pedido_items.color / talla: lo que eligió la vendedora (texto, se conserva
--    aunque después se borre el color o la talla del producto)
-- crear_pedido, editar_pedido y registrar_venta_local guardan "color" y "talla"
-- de cada item (p_items) en el insert de pedido_items.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
alter table public.productos add column if not exists imagenes text[] default '{}', add column if not exists tallas text[] default '{}';
alter table public.productos drop constraint if exists productos_tallas_max,
  add constraint productos_tallas_max check (cardinality(tallas) <= 40 and cardinality(imagenes) <= 12);
alter table public.pedido_items add column if not exists color text check (color is null or length(color) <= 40),
  add column if not exists talla text check (talla is null or length(talla) <= 40);

do $$
declare f text; s text; n int;
begin
  foreach f in array array['public.crear_pedido(text,text,text,text,text,numeric,jsonb,text)', 'public.editar_pedido(bigint,text,text,text,text,text,numeric,jsonb)', 'public.registrar_venta_local(text,text,text,jsonb,text,numeric,numeric,bigint)'] loop
    s := pg_get_functiondef(f::regprocedure);
    if position('color, talla' in s) > 0 then continue; end if;
    s := replace(s, 'precio_base, precio_compra, total)', 'precio_base, precio_compra, total, color, talla)');
    n := length(s);
    s := replace(s, 'v_precio * (it->>''cantidad'')::int);', 'v_precio * (it->>''cantidad'')::int, nullif(left(trim(it->>''color''), 40), ''''), nullif(left(trim(it->>''talla''), 40), ''''));');
    s := replace(s, 'v_precio * v_cant);', 'v_precio * v_cant, nullif(left(trim(it->>''color''), 40), ''''), nullif(left(trim(it->>''talla''), 40), ''''));');
    if length(s) = n then raise exception 'No se encontró el insert en %', f; end if;
    execute s;
  end loop;
end $$;
