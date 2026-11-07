-- YA APLICADO en Supabase (2026-11-07).
-- Ranking: las ventas del local también cuentan para cada vendedora (antes solo domicilio).
-- Se quitó el filtro  where coalesce(canal, 'domicilio') = 'domicilio'  del CTE "v" en public.ranking(date, date, text).
do $$
declare d text;
begin
  d := replace(pg_get_functiondef('public.ranking(date,date,text)'::regprocedure), chr(13), '');
  d := replace(d, $x$from ent
        where coalesce(canal, 'domicilio') = 'domicilio' group by 1),$x$, $x$from ent
        group by 1),$x$);
  execute d;
end $$;
