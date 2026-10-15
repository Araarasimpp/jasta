-- Pedidos como en Home ALS: ajustes de alistamiento en la base.
-- Correr una vez en Supabase → SQL Editor.
--
-- 1. Alistamiento (no solo el admin) puede "Quitar de alistados": devolver un
--    pedido alistado a por alistar.
-- 2. Quitar el mensajero de un pedido en ruta lo devuelve a Alistados sin
--    perder su puesto (1°, 2°…): se conserva la hora en que se alistó.

create or replace function public.cambiar_estado(p_pedido bigint, p_estado estado_pedido, p_mensajero bigint default null::bigint)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare p public.pedidos; v_yo bigint := public.mi_usuario_id(); v_admin boolean := public.tiene_rol('admin');
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado in ('entregado','cancelado') and not v_admin then raise exception 'El pedido ya está %', lower(public.estado_label(p.estado)); end if;
  if p_estado = 'alistado' then
    if not (v_admin or public.tiene_rol('alistador')) then raise exception 'Solo alistamiento puede marcarlo alistado'; end if;
  elsif p_estado = 'despachado' then
    if not (v_admin or public.tiene_rol('alistador')) then raise exception 'No tienes permiso para despachar'; end if;
    if coalesce(p_mensajero, p.mensajero_id) is null then raise exception 'Asigna un mensajero para despachar'; end if;
  elsif p_estado = 'cancelado' then
    if not v_admin and not (p.vendedora_id = v_yo and p.estado = 'por_alistar') then raise exception 'Solo el admin puede cancelar este pedido'; end if;
    if p.estado = 'entregado' and p.stock_descontado then
      update public.productos pr set stock = pr.stock + i.cantidad, updated_at = now()
        from public.pedido_items i where i.pedido_id = p.id and i.producto_id = pr.id and pr.controla_stock;
      update public.pedidos set stock_descontado = false where id = p.id;
    end if;
  elsif p_estado = 'por_alistar' then
    -- Antes: solo el admin. Ahora alistamiento también puede quitar de alistados.
    if not (v_admin or (public.tiene_rol('alistador') and p.estado = 'alistado')) then
      raise exception 'Solo el admin puede devolver el pedido';
    end if;
  elsif p_estado = 'entregado' then
    raise exception 'Usa entregar_pedido';
  end if;
  update public.pedidos set estado = p_estado, updated_at = now(),
    mensajero_id = coalesce(p_mensajero, mensajero_id),
    asignado_at = case when p_mensajero is not null and p_mensajero is distinct from p.mensajero_id then now() else asignado_at end
  where id = p_pedido;
  perform public.nota(p_pedido, 'Estado: ' || public.estado_label(p.estado) || ' → ' || public.estado_label(p_estado)
    || case when p_mensajero is not null then ' (mensajero: ' || (select nombre from public.usuarios where id = p_mensajero) || ')' else '' end);
end $function$;

-- Al volver a Alistados (por ejemplo, al quitarle el mensajero) conserva la hora
-- en que se alistó la primera vez; "por alistar" la borra, como antes.
create or replace function public.marcar_alistado_at()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.estado = 'alistado' and old.estado is distinct from 'alistado' then new.alistado_at := coalesce(old.alistado_at, now());
  elsif new.estado = 'por_alistar' then new.alistado_at := null;
  end if;
  return new;
end $function$;
