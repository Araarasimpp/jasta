-- YA APLICADO (2026-11-04)
-- En el catálogo público el barrio (o la ciudad, si no es de Cali) tiene que estar en la tabla de domicilios.
do $$
declare v text := pg_get_functiondef('public.tienda_pedir(bigint,text,text,text,text,text,jsonb,text)'::regprocedure);
begin
  if position('Si no eres de Cali' in v) = 0 then
    v := replace(v, '  if v_linea then
    if v_dom is null then', '  if v_dom is null then raise exception ''Elige tu barrio de la lista. Si no eres de Cali, escribe solo el nombre de tu ciudad.''; end if;
  if v_linea then
    if v_dom is null then');
    if position('Si no eres de Cali' in v) = 0 then raise exception 'No se pudo cambiar tienda_pedir'; end if;
    execute v;
  end if;
end $$;
