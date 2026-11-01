-- Comisiones por fecha de creación del pedido (YA APLICADO)
-- Un pedido cuenta en la semana del día en que se creó, no del día en que se entregó.
-- Ej.: creado el viernes 23 y entregado el sábado 24 → es de la semana anterior, no de la del 24.
-- Sigue siendo necesario que esté entregado para que cuente.
do $$
declare v_def text; fn text;
begin
  foreach fn in array array['privado.por_liquidar(bigint)', 'public.liquidacion_pedidos(bigint,bigint)'] loop
    v_def := regexp_replace(pg_get_functiondef(fn::regprocedure), E'\r', '', 'g');
    if position('coalesce(p.entregado_at, p.created_at)' in v_def) = 0 then continue; end if;
    execute replace(v_def, 'coalesce(p.entregado_at, p.created_at)', 'p.created_at');
  end loop;
end $$;
