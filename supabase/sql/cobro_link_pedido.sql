-- Cobrar cualquier pedido con un link de pago de Wompi (YA APLICADO 2026-11-05)
-- La vendedora o el admin crea el link desde el pedido y se lo manda al cliente. Cuando Wompi aprueba,
-- el pedido queda pagado en línea (pagado_linea): el domiciliario no cobra y en los envíos nacionales
-- no hace falta comprobante. El cliente paga la comisión de Wompi (si así se elige al crear el link).

alter table public.pedidos
  add column if not exists cobro_recargo numeric,
  add column if not exists wompi_link text,
  add column if not exists wompi_link_vence timestamptz,
  add column if not exists wompi_link_valor numeric,
  add column if not exists cobro_estado text check (cobro_estado in ('pendiente', 'aprobado', 'rechazado'));
create unique index if not exists pedidos_wompi_link_idx on public.pedidos (wompi_link) where wompi_link is not null;

-- Deja el pedido listo para cobrar por link (el link lo crea la función wompi-pagar)
create or replace function public.preparar_cobro_link(p_pedido bigint, p_con_recargo boolean default true)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_rec numeric;
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Ese pedido no existe'; end if;
  if not (public.tiene_rol('admin') or (p.vendedora_id = public.mi_usuario_id() and public.tiene_rol('vendedora'))) then raise exception 'Sin permiso'; end if;
  if p.estado in ('cancelado') then raise exception 'El pedido está cancelado'; end if;
  if p.estado = 'entregado' and p.canal = 'local' then raise exception 'Las ventas del local ya están pagadas'; end if;
  if p.pagado_linea is not null then raise exception 'Este pedido ya está pagado en línea'; end if;
  if coalesce(p.total, 0) <= 0 then raise exception 'El pedido no tiene valor'; end if;
  v_rec := case when coalesce(p_con_recargo, true) then privado.recargo_wompi(p.total) else 0 end;
  -- Si cambió el valor, el link anterior ya no sirve
  update public.pedidos set cobro_recargo = v_rec, cobro_estado = 'pendiente',
    wompi_link = case when wompi_link_valor = p.total + v_rec then wompi_link end,
    wompi_link_vence = case when wompi_link_valor = p.total + v_rec then wompi_link_vence end
   where id = p.id;
  return jsonb_build_object('seguimiento', p.seguimiento, 'base', p.total, 'recargo', v_rec, 'total', p.total + v_rec);
end $function$;
revoke execute on function public.preparar_cobro_link(bigint, boolean) from public, anon;
grant execute on function public.preparar_cobro_link(bigint, boolean) to authenticated;

-- Resultado de un pago por link de un pedido
create or replace function public.wompi_registrar_pedido(p_link text, p_tx text, p_estado text, p_centavos bigint, p_metodo text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_dest bigint[];
begin
  select * into p from public.pedidos where wompi_link = p_link for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'link desconocido'); end if;
  if p.pagado_linea is not null then return jsonb_build_object('ok', true, 'ya', true); end if;
  if p_estado = 'APPROVED' then
    if p_centavos < round(p.total * 100) then
      perform privado.avisar(privado.con_rol(array['admin']), 'pedido', 'Pago por link incompleto · pedido #' || p.id,
        'Wompi aprobó ' || privado.pesos(p_centavos / 100.0) || ' y el pedido vale ' || privado.pesos(p.total) || '. Revísalo.', '/app/pedidos?id=' || p.id, p.id);
      return jsonb_build_object('ok', false, 'motivo', 'monto');
    end if;
    update public.pedidos set pagado_linea = p.total, wompi_tx = p_tx, cobro_estado = 'aprobado', updated_at = now() where id = p.id;
    perform public.nota(p.id, 'Pagado en línea por link de Wompi (' || coalesce(p_metodo, '') || '): ' || privado.pesos(p.total) || '. No se le cobra al entregar.');
    v_dest := array_remove(array[p.vendedora_id, p.mensajero_id], null) || privado.con_rol(array['admin']);
    perform privado.avisar(v_dest, 'pedido', '💳 Pagó el pedido #' || p.id || ' por link · ' || privado.pesos(p.total),
      split_part(coalesce(p.cliente_nombre, 'El cliente'), ' ', 1) || ' ya pagó en línea. Al entregar no se le cobra nada.', '/app/pedidos?id=' || p.id, p.id);
    return jsonb_build_object('ok', true);
  elsif p_estado in ('DECLINED', 'ERROR', 'VOIDED') then
    update public.pedidos set cobro_estado = 'rechazado' where id = p.id and pagado_linea is null;
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', true, 'pendiente', true);
end $function$;
revoke all on function public.wompi_registrar_pedido(text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.wompi_registrar_pedido(text, text, text, bigint, text) to service_role;

-- Los eventos de Wompi: si el link no es de un pedido de la tienda, se busca en los pedidos
do $$
declare v text := pg_get_functiondef('public.wompi_registrar(text,text,text,bigint,text)'::regprocedure);
begin
  if position('wompi_registrar_pedido' in v) = 0 then
    v := replace(v, 'if not found then return jsonb_build_object(''ok'', false, ''motivo'', ''link desconocido''); end if;',
      'if not found then return public.wompi_registrar_pedido(p_link, p_tx, p_estado, p_centavos, p_metodo); end if;');
    if position('wompi_registrar_pedido' in v) = 0 then raise exception 'No se pudo cambiar wompi_registrar'; end if;
    execute v;
  end if;
end $$;

-- La página de seguimiento muestra si hay un cobro pendiente o si ya pagó
do $$
declare v text := pg_get_functiondef('public.seguimiento(uuid)'::regprocedure);
begin
  if position('''cobro''' in v) = 0 then
    v := replace(v, '''envio_nacional'', p.envio_nacional,',
      '''envio_nacional'', p.envio_nacional, ''pagado_linea'', p.pagado_linea,
    ''cobro'', case when p.cobro_estado in (''pendiente'', ''rechazado'') and p.pagado_linea is null and p.estado <> ''cancelado''
                    then jsonb_build_object(''total'', p.total + coalesce(p.cobro_recargo, 0), ''recargo'', coalesce(p.cobro_recargo, 0), ''estado'', p.cobro_estado) end,');
    if position('''cobro''' in v) = 0 then raise exception 'No se pudo cambiar seguimiento'; end if;
    execute v;
  end if;
end $$;
