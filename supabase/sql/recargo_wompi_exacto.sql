-- YA APLICADO (2026-11-04)
-- El cargo del pago en línea ya no es un 5% fijo: es la comisión real de Wompi (2,65 % + $700, más IVA
-- del 19 % sobre la comisión), redondeada a $100 hacia arriba, para que al negocio le llegue completo
-- el pedido. Ej: pedido de $14.000 → paga $15.400 → Wompi descuenta $1.318 → quedan $14.081.
create or replace function privado.recargo_wompi(p_base numeric)
returns numeric language sql immutable set search_path to '' as $$
  select case when coalesce(p_base, 0) <= 0 then 0
    else ceil(((p_base + 700 * 1.19) / (1 - 0.0265 * 1.19) - p_base) / 100) * 100 end
$$;
do $$
declare v text := pg_get_functiondef('public.tienda_pedir(bigint,text,text,text,text,text,jsonb,text)'::regprocedure);
begin
  if position('recargo_wompi' in v) = 0 then
    v := replace(v, 'v_recargo := round((v_sub + v_dom) * 0.05);', 'v_recargo := privado.recargo_wompi(v_sub + v_dom);');
    if position('recargo_wompi' in v) = 0 then raise exception 'No se pudo cambiar tienda_pedir'; end if;
    execute v;
  end if;
end $$;
