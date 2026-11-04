-- Envíos nacionales por transportadora (Servientrega, Interrapidísimo, etc.) — rama envios-nacionales
-- YA APLICADO (2026-11-04). Solo agrega columnas y funciones nuevas; lo de main sigue igual.
-- Pago siempre anticipado: al despachar se adjunta el comprobante del pago del cliente, el pedido
-- queda entregado (sale del negocio) con el número de guía, y la transferencia entra a "por revisar".

alter table public.pedidos
  add column if not exists envio_nacional boolean not null default false,
  add column if not exists destino_ciudad text,
  add column if not exists destino_departamento text,
  add column if not exists destinatario_cedula text,
  add column if not exists transportadora text,
  add column if not exists guia text,
  add column if not exists costo_envio numeric,
  add column if not exists enviado_at timestamptz;

-- Al crear el pedido: lo marca como envío nacional con los datos del destino
create or replace function public.marcar_envio_nacional(p_pedido bigint, p_ciudad text, p_departamento text, p_cedula text)
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_ciudad text := privado.limpio(p_ciudad, 80); v_dep text := privado.limpio(p_departamento, 60);
  v_cc text := regexp_replace(coalesce(p_cedula, ''), '[^0-9A-Za-z]', '', 'g');
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Ese pedido no existe'; end if;
  if not (public.tiene_rol('admin') or (p.vendedora_id = public.mi_usuario_id() and public.tiene_rol('vendedora'))) then raise exception 'Sin permiso'; end if;
  if p.estado in ('entregado', 'cancelado') then raise exception 'Este pedido ya no se puede cambiar'; end if;
  if v_ciudad is null or length(v_ciudad) < 3 then raise exception 'Escribe la ciudad de destino'; end if;
  if v_dep is null or length(v_dep) < 3 then raise exception 'Escribe el departamento'; end if;
  if length(v_cc) < 5 or length(v_cc) > 15 then raise exception 'Revisa la cédula del destinatario (la pide la transportadora)'; end if;
  update public.pedidos set envio_nacional = true, destino_ciudad = initcap(v_ciudad), destino_departamento = initcap(v_dep),
    destinatario_cedula = v_cc, barrio = coalesce(nullif(barrio, ''), initcap(v_ciudad))
   where id = p.id;
  perform public.nota(p.id, 'Envío nacional a ' || initcap(v_ciudad) || ', ' || initcap(v_dep) || ' · pago anticipado');
end $function$;

-- Despachar por transportadora: guía, costo del envío y comprobante del pago del cliente
create or replace function public.despachar_nacional(p_pedido bigint, p_transportadora text, p_guia text, p_costo_envio numeric, p_evidencias text[])
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_ev text[]; v_guia text := upper(regexp_replace(coalesce(p_guia, ''), '\s', '', 'g'));
  v_trans text := privado.limpio(p_transportadora, 40);
begin
  if not (public.tiene_rol('admin') or public.tiene_rol('alistador')) then raise exception 'Solo el admin o alistamiento despacha envíos'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Ese pedido no existe'; end if;
  if not p.envio_nacional then raise exception 'Este pedido no es un envío nacional'; end if;
  if p.estado not in ('por_alistar', 'alistado', 'despachado') then raise exception 'El pedido ya está %', lower(public.estado_label(p.estado)); end if;
  if v_trans is null then raise exception 'Elige la transportadora'; end if;
  if length(v_guia) < 5 or length(v_guia) > 40 then raise exception 'Revisa el número de guía'; end if;
  v_ev := privado.comprobantes_validos(p_evidencias);
  if p.pagado_linea is null and cardinality(v_ev) = 0 then raise exception 'Sube el comprobante del pago del cliente (el envío es con pago anticipado)'; end if;
  update public.pedidos set estado = 'entregado', entregado_at = now(), updated_at = now(),
    tipo_recaudo = 'transferencia', valor_efectivo = 0, valor_transferencia = p.total, propina = 0,
    transportadora = v_trans, guia = v_guia, costo_envio = case when p_costo_envio >= 0 then round(p_costo_envio) end, enviado_at = now(),
    stock_descontado = true,
    evidencias = case when cardinality(v_ev) > 0 then coalesce(evidencias, '{}') || v_ev else evidencias end
  where id = p.id;
  if not p.stock_descontado then
    update public.productos pr set stock = pr.stock - i.cantidad, updated_at = now()
      from public.pedido_items i where i.pedido_id = p.id and i.producto_id = pr.id and pr.controla_stock;
  end if;
  perform public.nota(p.id, 'Enviado por ' || v_trans || ' · guía ' || v_guia
    || case when p_costo_envio > 0 then ' · costo del envío ' || privado.pesos(p_costo_envio) else '' end);
  if p.vendedora_id is not null then
    perform privado.avisar(array[p.vendedora_id], 'pedido', '📦 Salió el pedido #' || p.id || ' por ' || v_trans,
      'Guía ' || v_guia || ' · ' || coalesce(p.destino_ciudad, '') || '. Mándale al cliente el enlace de seguimiento.', '/app/pedidos?id=' || p.id, p.id);
  end if;
end $function$;

revoke execute on function public.marcar_envio_nacional(bigint, text, text, text), public.despachar_nacional(bigint, text, text, numeric, text[]) from public, anon;
grant execute on function public.marcar_envio_nacional(bigint, text, text, text), public.despachar_nacional(bigint, text, text, numeric, text[]) to authenticated;

-- La página de seguimiento del cliente muestra la transportadora y la guía
do $$
declare v text := pg_get_functiondef('public.seguimiento(uuid)'::regprocedure);
begin
  if position('''guia''' in v) = 0 then
    v := replace(v, '''total'', p.total, ''domicilio'', p.valor_domicilio,',
      '''total'', p.total, ''domicilio'', p.valor_domicilio, ''envio_nacional'', p.envio_nacional, ''transportadora'', p.transportadora, ''guia'', p.guia,
    ''destino'', nullif(concat_ws('', '', p.destino_ciudad, p.destino_departamento), ''''), ''enviado_at'', p.enviado_at,');
    if position('''guia''' in v) = 0 then raise exception 'No se pudo cambiar seguimiento'; end if;
    execute v;
  end if;
end $$;
