-- Ganancia de la tienda en ventas sin vendedora (YA APLICADO)
-- En una venta con vendedora, lo cobrado por encima del precio base es de ella. En una venta sin
-- vendedora (por ejemplo, una venta del local "de la tienda"), ese margen no es de nadie más:
-- es de la tienda. Antes se perdía en Inicio, Utilidad real, el cierre del día, Reportes y Rentabilidad.

create or replace function privado.ganancia_tienda_item(p_venta numeric, p_base numeric, p_compra numeric, p_cantidad numeric, p_vendedora bigint)
returns numeric language sql immutable set search_path to '' as $$
  select (case when p_vendedora is null then coalesce(p_venta, 0) else coalesce(p_base, 0) end - coalesce(p_compra, 0)) * coalesce(p_cantidad, 0)
$$;

do $$
declare
  v_def text;
  -- (función, texto que se busca, texto nuevo)
  cambios text[][] := array[
    ['public.ganancia_por_dia(date,date)',
     'sum((i.precio_base - i.precio_compra) * i.cantidad)',
     'sum(privado.ganancia_tienda_item(i.precio_venta, i.precio_base, i.precio_compra, i.cantidad, p.vendedora_id))'],
    ['public.gastos_resumen(date,date)',
     'sum((i.precio_base - i.precio_compra) * i.cantidad)',
     'sum(privado.ganancia_tienda_item(i.precio_venta, i.precio_base, i.precio_compra, i.cantidad, p.vendedora_id))'],
    ['privado.cierre_dia_texto(date)',
     'sum((i.precio_base - i.precio_compra) * i.cantidad)',
     'sum(privado.ganancia_tienda_item(i.precio_venta, i.precio_base, i.precio_compra, i.cantidad, p.vendedora_id))'],
    ['public.rentabilidad(date,date)',
     'sum((i.precio_base - i.precio_compra) * i.cantidad) gan_tienda',
     'sum(privado.ganancia_tienda_item(i.precio_venta, i.precio_base, i.precio_compra, i.cantidad, p.vendedora_id)) gan_tienda'],
    ['public.rentabilidad(date,date)',
     'sum((i.precio_venta - i.precio_base) * i.cantidad) gan_vend',
     'sum((i.precio_venta - i.precio_base) * i.cantidad) filter (where p.vendedora_id is not null) gan_vend'],
    ['public.reporte_totales_filtrado(date,date,text,bigint)',
     '(select coalesce(sum((precio_base - precio_compra) * cantidad),0) from it)',
     '(select coalesce(sum(privado.ganancia_tienda_item(it.precio_venta, it.precio_base, it.precio_compra, it.cantidad, ent.vendedora_id)),0) from it join ent on ent.id = it.pedido_id)'],
    ['public.reporte_totales_filtrado(date,date,text,bigint)',
     '(select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it)',
     '(select coalesce(sum((it.precio_venta - it.precio_base) * it.cantidad) filter (where ent.vendedora_id is not null),0) from it join ent on ent.id = it.pedido_id)'],
    ['public.resumen(date,date)',
     '(select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it)',
     '(select coalesce(sum((it.precio_venta - it.precio_base) * it.cantidad) filter (where ent.vendedora_id is not null),0) from it join ent on ent.id = it.pedido_id)']
  ];
  c text[];
begin
  foreach c slice 1 in array cambios loop
    v_def := regexp_replace(pg_get_functiondef(c[1]::regprocedure), E'\r', '', 'g');
    if position(c[3] in v_def) > 0 then continue; end if; -- ya estaba
    if position(c[2] in v_def) = 0 then raise exception 'No encontré la fórmula en %', c[1]; end if;
    execute replace(v_def, c[2], c[3]);
  end loop;
end $$;
