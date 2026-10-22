-- Admin: un pedido marcado como entregado por error (p. ej. con el comprobante equivocado)
-- vuelve a En ruta con el mismo mensajero, para que lo entregue de nuevo con el soporte correcto.
-- Solo si todavía no entró a un cuadre.
create or replace function public.devolver_entrega(p_pedido bigint)
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede devolver una entrega'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if p.estado <> 'entregado' then raise exception 'El pedido no está entregado'; end if;
  if p.cuadre_id is not null then raise exception 'El pedido ya está en un cuadre: no se puede devolver'; end if;
  if p.mensajero_id is null then raise exception 'El pedido no tiene mensajero'; end if;
  -- Vuelve a En ruta con el mismo mensajero. El stock sigue descontado (stock_descontado = true),
  -- así al volver a entregarlo no se descuenta dos veces. El comprobante anterior se quita del pedido.
  update public.pedidos set estado = 'despachado', entregado_at = null, updated_at = now(),
    tipo_recaudo = null, valor_efectivo = null, valor_transferencia = null,
    evidencias = null, evidencia_transferencia = null
  where id = p_pedido;
  perform public.nota(p_pedido, 'Entrega devuelta a En ruta por el admin (antes: ' || coalesce(p.tipo_recaudo, '—')
    || case when cardinality(coalesce(p.evidencias, '{}')) > 0 then ', comprobante anterior: ' || array_to_string(p.evidencias, ', ') else '' end || ')');
end $function$;
revoke execute on function public.devolver_entrega(bigint) from public, anon;
grant execute on function public.devolver_entrega(bigint) to authenticated;
