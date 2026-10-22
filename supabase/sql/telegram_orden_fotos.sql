-- ============================================================================
--  Jasta · Ruta en el orden de las fotos de Telegram
--  YA APLICADO en Supabase (proyecto Jasta); se guarda como registro.
--
--  En el grupo del mensajero pueden estar los dos bots (Jasta y Variedades JYB).
--  Cada uno tarda distinto en leer el QR, así que la hora en que se procesa no
--  sirve para ordenar. La hora de asignación queda como la hora en que se mandó la
--  foto en Telegram (+ el número del mensaje como desempate dentro del mismo
--  segundo: los dos bots ven los mismos números de mensaje del grupo).
-- ============================================================================

create or replace function public.telegram_despachar_orden(p_chat_id bigint, p_message_id bigint, p_telegram_id bigint, p_pedido bigint, p_fecha bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare r jsonb; v_cuando timestamptz;
begin
  r := public.telegram_despachar(p_chat_id, p_message_id, p_telegram_id, p_pedido);
  if coalesce((r->>'ok')::boolean, false) and not coalesce((r->>'repetido')::boolean, false) and p_fecha is not null then
    v_cuando := least(to_timestamp(p_fecha) + (p_message_id % 1000000) * interval '1 microsecond', now());
    update public.pedidos set asignado_at = v_cuando where id = p_pedido and estado = 'despachado';
  end if;
  return r;
end;
$function$;
revoke all on function public.telegram_despachar_orden(bigint, bigint, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.telegram_despachar_orden(bigint, bigint, bigint, bigint, bigint) to service_role;
