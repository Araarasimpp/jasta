-- YA APLICADO en Supabase (2026-11-09).
-- Pedidos de la tienda sospechosos: señales del pedido (además de riesgo_cliente, que mira el historial del teléfono).
--   · varios pedidos del mismo celular en 24 h (antes de este)
--   · la misma conexión (IP) con 3+ celulares distintos en 24 h
--   · pedidos de la tienda cancelados antes (sin contar pagos en línea no completados)
--   · la misma dirección con rechazos de otro celular
--   · el mismo celular con otro nombre
--   · cliente nuevo con pedido de $300.000+ para pagar al recibir
-- No marca pedidos con el celular de alguien del equipo. pedidos_web_lista() devuelve 'sospecha' en los por confirmar.
-- (Definición vigente: select pg_get_functiondef('public.sospecha_pedido_web(bigint)'::regprocedure);)
create or replace function privado.dir_normal(t text) returns text language sql immutable set search_path = '' as $$
  select regexp_replace(lower(translate(coalesce(t, ''), 'áéíóúÁÉÍÓÚ#-', 'aeiouAEIOU  ')), '[^a-z0-9]', '', 'g')
$$;
