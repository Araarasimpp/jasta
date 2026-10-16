-- Las funciones de importación desde WordPress quedaban abiertas a cualquiera
-- con la clave pública (protegidas solo por un token). Ahora solo las puede
-- llamar el servidor (service_role). En las últimas 24 h no las había llamado
-- nadie por la API, así que la sincronización no las usa por ahí.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
revoke execute on function public.importar_lote(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.sincronizar_lote(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.importar_evidencias(text, jsonb) from public, anon, authenticated;
grant execute on function public.importar_lote(text, text, jsonb) to service_role;
grant execute on function public.sincronizar_lote(text, text, jsonb) to service_role;
grant execute on function public.importar_evidencias(text, jsonb) to service_role;
