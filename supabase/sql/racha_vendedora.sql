-- YA APLICADO (2026-11-17). Queda aquí como registro.
-- Racha de la vendedora: días seguidos con al menos un pedido (no cancelado). Si hoy aún
-- no ha vendido, la racha cuenta hasta ayer (y la app le avisa que venda hoy para no perderla).
-- También: el aviso de foto / nota de voz del chat ya no lleva emojis (enviar_mensaje2).

create or replace function public.mi_racha()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_hoy_vendio boolean;
  v_dia date;
  v_n int := 0;
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  v_hoy_vendio := exists (select 1 from public.pedidos where vendedora_id = v_yo and estado <> 'cancelado'
    and (created_at at time zone 'America/Bogota')::date = v_hoy);
  v_dia := case when v_hoy_vendio then v_hoy else v_hoy - 1 end;
  while v_n < 366 and exists (select 1 from public.pedidos where vendedora_id = v_yo and estado <> 'cancelado'
      and created_at >= (v_dia::text || ' 00:00 America/Bogota')::timestamptz
      and created_at < ((v_dia + 1)::text || ' 00:00 America/Bogota')::timestamptz) loop
    v_n := v_n + 1;
    v_dia := v_dia - 1;
  end loop;
  return jsonb_build_object('dias', v_n, 'hoy', v_hoy_vendio);
end $function$;
grant execute on function public.mi_racha() to authenticated;
