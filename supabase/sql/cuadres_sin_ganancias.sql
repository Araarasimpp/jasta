-- El rol Cuadres no ve la ganancia de la tienda ni los reportes: solo los cuadres de
-- los mensajeros y el cuadre del recolector. Ya aplicado en Supabase; respaldo.
do $$
declare f text; def text;
begin
  foreach f in array array['public.resumen(date,date)', 'public.ganancia_por_dia(date,date)'] loop
    def := pg_get_functiondef(f::regprocedure);
    def := replace(def, $q$if not (public.tiene_rol('admin') or public.tiene_rol('cuadres')) then$q$, $q$if not public.tiene_rol('admin') then$q$);
    execute def;
  end loop;
  foreach f in array array['public.reporte_filtrado(date,date,text,bigint)', 'public.reporte_totales_filtrado(date,date,text,bigint)'] loop
    def := pg_get_functiondef(f::regprocedure);
    def := replace(def, $q$v_todo boolean := public.tiene_rol('admin') or public.tiene_rol('cuadres');$q$, $q$v_todo boolean := public.tiene_rol('admin');$q$);
    execute def;
  end loop;
  -- Cuadres ve el cuadre del recolector (solo lectura, como el admin)
  def := pg_get_functiondef('public.recoleccion_resumen(date,date,bigint)'::regprocedure);
  def := replace(def, $q$v_admin boolean := public.tiene_rol('admin');$q$, $q$v_admin boolean := public.tiene_rol('admin') or public.tiene_rol('cuadres');$q$);
  execute def;
end $$;
