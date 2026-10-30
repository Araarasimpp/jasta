-- Reportes: filtro por canal (domicilios / ventas del local) (YA APLICADO)
-- Además las vistas de "línea por línea" cuentan la ganancia como el resto de la app:
-- en ventas sin vendedora, el margen completo es de la tienda.

-- 1) Vistas con la columna canal (al final, para no cambiar el orden) y la ganancia corregida
create or replace view public.ventas_detalle with (security_invoker = true) as
 SELECT i.id,
    p.id AS pedido_id,
    p.created_at,
    p.entregado_at,
    p.estado,
    p.cliente_nombre,
    p.cliente_telefono,
    p.barrio,
    v.nombre AS vendedora,
    m.nombre AS mensajero,
    p.vendedora_id,
    p.mensajero_id,
    i.producto_id,
    i.nombre AS producto,
    pr.sku,
    i.cantidad,
    i.precio_venta,
    i.precio_base,
    i.precio_compra,
    i.total,
    i.precio_compra * i.cantidad::numeric AS costo,
    (CASE WHEN p.vendedora_id IS NULL THEN i.precio_venta ELSE i.precio_base END - i.precio_compra) * i.cantidad::numeric AS ganancia_tienda,
    CASE WHEN p.vendedora_id IS NULL THEN 0::numeric ELSE
    (i.precio_venta - i.precio_base) * i.cantidad::numeric -
        CASE
            WHEN p.aporte_alcancia > 0::numeric AND i.id = (( SELECT min(x.id) AS min
               FROM pedido_items x
              WHERE x.pedido_id = p.id)) THEN p.aporte_alcancia
            ELSE 0::numeric
        END END AS ganancia_vendedora,
    p.valor_domicilio AS domicilio_pedido,
    p.tipo_recaudo,
    i.color,
    i.talla,
    p.canal::text AS canal
   FROM pedido_items i
     JOIN pedidos p ON p.id = i.pedido_id
     LEFT JOIN productos pr ON pr.id = i.producto_id
     LEFT JOIN usuarios v ON v.id = p.vendedora_id
     LEFT JOIN usuarios m ON m.id = p.mensajero_id;

create or replace view public.ventas_pedidos with (security_invoker = true) as
 SELECT p.id,
    p.created_at,
    p.entregado_at,
    p.estado,
    p.cliente_nombre,
    p.cliente_telefono,
    p.barrio,
    v.nombre AS vendedora,
    m.nombre AS mensajero,
    p.vendedora_id,
    p.mensajero_id,
    COALESCE(s.productos, ''::text) AS productos,
    COALESCE(s.unidades, 0::bigint) AS unidades,
    COALESCE(s.subtotal, 0::numeric) AS subtotal,
    p.valor_domicilio AS domicilio,
    p.total,
    COALESCE(s.costo, 0::numeric) AS costo,
    COALESCE(s.ganancia_tienda, 0::numeric) AS ganancia_tienda,
    CASE WHEN p.vendedora_id IS NULL THEN 0::numeric ELSE COALESCE(s.ganancia_vendedora, 0::numeric) - p.aporte_alcancia END AS ganancia_vendedora,
    p.tipo_recaudo,
    p.valor_efectivo,
    p.valor_transferencia,
    p.aporte_alcancia,
    p.canal::text AS canal
   FROM pedidos p
     LEFT JOIN usuarios v ON v.id = p.vendedora_id
     LEFT JOIN usuarios m ON m.id = p.mensajero_id
     LEFT JOIN LATERAL ( SELECT string_agg(i.nombre ||
                CASE
                    WHEN i.cantidad > 1 THEN ' x'::text || i.cantidad
                    ELSE ''::text
                END, ', '::text ORDER BY i.id) AS productos,
            sum(i.cantidad) AS unidades,
            sum(i.total) AS subtotal,
            sum(i.precio_compra * i.cantidad::numeric) AS costo,
            sum((CASE WHEN p.vendedora_id IS NULL THEN i.precio_venta ELSE i.precio_base END - i.precio_compra) * i.cantidad::numeric) AS ganancia_tienda,
            sum((i.precio_venta - i.precio_base) * i.cantidad::numeric) AS ganancia_vendedora
           FROM pedido_items i
          WHERE i.pedido_id = p.id) s ON true;

-- 2) Las cuatro funciones de Reportes reciben p_canal ('domicilio', 'local' o null = todos)
do $$
declare
  v_def text; v_firma text;
  f record;
begin
  for f in select * from (values
    ('public.reporte_filtrado(date,date,text,bigint)', 'p_vendedora bigint DEFAULT NULL::bigint)', 'and (v_vend is null or vendedora_id = v_vend)', 'canal::text'),
    ('public.reporte_totales_filtrado(date,date,text,bigint)', 'p_vendedora bigint DEFAULT NULL::bigint)', 'and (v_vend is null or vendedora_id = v_vend)', 'canal::text'),
    ('public.sumas_ventas_detalle(timestamptz,timestamptz,text,bigint,text)', 'p_texto text DEFAULT ''''::text)', 'and (p_vendedora is null or v.vendedora_id = p_vendedora)', 'v.canal'),
    ('public.sumas_ventas_pedidos(timestamptz,timestamptz,text,bigint,text)', 'p_texto text DEFAULT ''''::text)', 'and (p_vendedora is null or v.vendedora_id = p_vendedora)', 'v.canal')
  ) x(fn, firma, filtro, col) loop
    if to_regprocedure(f.fn) is null then continue; end if; -- ya cambiada
    v_def := regexp_replace(pg_get_functiondef(f.fn::regprocedure), E'\r', '', 'g');
    if position(f.firma in v_def) = 0 or position(f.filtro in v_def) = 0 then raise exception 'No encontré dónde poner el canal en %', f.fn; end if;
    v_def := replace(v_def, f.firma, replace(f.firma, ')', ', p_canal text DEFAULT NULL::text)'));
    v_def := replace(v_def, f.filtro, f.filtro || ' and (p_canal is null or ' || f.col || ' = p_canal)');
    execute 'drop function ' || f.fn;
    execute v_def;
    v_firma := replace(f.fn, ')', ',text)');
    execute 'revoke execute on function ' || v_firma || ' from public, anon';
    execute 'grant execute on function ' || v_firma || ' to authenticated, service_role';
  end loop;
end $$;
