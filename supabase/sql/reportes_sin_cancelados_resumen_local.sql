-- Reportes sin pedidos cancelados y resumen del local para Inicio (YA APLICADO)

-- 1) Reportes: los cancelados nunca cuentan (ni en "Todos los estados")
do $$
declare
  v_def text;
  cambios text[][] := array[
    ['public.reporte_filtrado(date,date,text,bigint)',
     '(v_est = ''todos'' or estado::text = v_est)',
     'estado <> ''cancelado'' and (v_est = ''todos'' or estado::text = v_est)'],
    ['public.reporte_totales_filtrado(date,date,text,bigint)',
     '(v_est = ''todos'' or estado::text = v_est)',
     'estado <> ''cancelado'' and (v_est = ''todos'' or estado::text = v_est)'],
    ['public.sumas_ventas_detalle(timestamptz,timestamptz,text,bigint,text)',
     '(coalesce(p_estado, ''todos'') = ''todos'' or v.estado::text = p_estado)',
     'v.estado <> ''cancelado'' and (coalesce(p_estado, ''todos'') = ''todos'' or v.estado::text = p_estado)'],
    ['public.sumas_ventas_pedidos(timestamptz,timestamptz,text,bigint,text)',
     '(coalesce(p_estado, ''todos'') = ''todos'' or v.estado::text = p_estado)',
     'v.estado <> ''cancelado'' and (coalesce(p_estado, ''todos'') = ''todos'' or v.estado::text = p_estado)']
  ];
  c text[];
begin
  foreach c slice 1 in array cambios loop
    v_def := regexp_replace(pg_get_functiondef(c[1]::regprocedure), E'\r', '', 'g');
    if position(c[3] in v_def) > 0 then continue; end if;
    if position(c[2] in v_def) = 0 then raise exception 'No encontré el filtro en %', c[1]; end if;
    execute replace(v_def, c[2], c[3]);
  end loop;
end $$;

-- 2) Ventas del local en un periodo (Inicio del admin): cuántas, total, efectivo, transferencias,
--    alcancía y lo que gana la tienda en ellas (con vendedora: base − compra; sin vendedora: venta − compra)
create or replace function public.resumen_local(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return (
    with v as (
      select * from public.pedidos
      where canal = 'local' and estado = 'entregado' and created_at >= d and created_at < h
    )
    select jsonb_build_object(
      'ventas', (select count(*) from v),
      'total', (select coalesce(sum(total), 0) from v),
      'efectivo', (select coalesce(sum(valor_efectivo), 0) from v),
      'transferencia', (select coalesce(sum(valor_transferencia), 0) from v),
      'alcancia', (select coalesce(sum(aporte_alcancia), 0) from v),
      'ganancia_tienda', (select coalesce(sum(privado.ganancia_tienda_item(i.precio_venta, i.precio_base, i.precio_compra, i.cantidad, v.vendedora_id)), 0)
                          from v join public.pedido_items i on i.pedido_id = v.id),
      'unidades', (select coalesce(sum(i.cantidad), 0) from v join public.pedido_items i on i.pedido_id = v.id))
  );
end $function$;
revoke execute on function public.resumen_local(date, date) from public, anon;
grant execute on function public.resumen_local(date, date) to authenticated;
