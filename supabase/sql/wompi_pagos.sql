-- Pagos en línea con Wompi en el catálogo público (YA APLICADO 2026-11-04)
-- Las llaves están en Vault (wompi_private_key, wompi_events_secret, wompi_public_key), nunca en el código.
-- Flujo: el cliente elige "Pagar ahora" → el pedido web queda 'por_pagar' (nadie lo ve todavía) →
-- la función wompi-pagar crea un link de pago de un solo uso por el total + 5% → Wompi avisa a
-- wompi-eventos (o la página de regreso verifica la transacción) → el pedido queda pagado y pasa a
-- 'por_confirmar' con aviso a la vendedora o al admin. Si no paga en 90 minutos se cancela solo.

-- ================================================================ 1. Columnas
alter table public.pedidos_web drop constraint if exists pedidos_web_estado_check;
alter table public.pedidos_web add constraint pedidos_web_estado_check check (estado in ('por_pagar', 'por_confirmar', 'confirmado', 'cancelado'));
alter table public.pedidos_web
  add column if not exists codigo uuid not null default gen_random_uuid(),
  add column if not exists pago text not null default 'contra_entrega' check (pago in ('contra_entrega', 'en_linea')),
  add column if not exists recargo numeric not null default 0,
  add column if not exists pago_estado text check (pago_estado in ('pendiente', 'aprobado', 'rechazado')),
  add column if not exists pago_metodo text,
  add column if not exists pagado_at timestamptz,
  add column if not exists wompi_link text,
  add column if not exists wompi_link_vence timestamptz,
  add column if not exists wompi_tx text;
create unique index if not exists pedidos_web_codigo_idx on public.pedidos_web (codigo);
create unique index if not exists pedidos_web_wompi_link_idx on public.pedidos_web (wompi_link) where wompi_link is not null;

alter table public.pedidos
  add column if not exists pagado_linea numeric,
  add column if not exists wompi_tx text;

-- ================================================================ 2. Llaves (solo el servidor)
create or replace function public.wompi_secreto(p_nombre text)
returns text language sql stable security definer set search_path to '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nombre and p_nombre like 'wompi\_%'
$$;
revoke all on function public.wompi_secreto(text) from public, anon, authenticated;
grant execute on function public.wompi_secreto(text) to service_role;

-- ================================================================ 3. Pedir desde la tienda (con forma de pago)
drop function if exists public.tienda_pedir(bigint, text, text, text, text, text, jsonb);
create or replace function public.tienda_pedir(p_vendedora bigint, p_nombre text, p_telefono text, p_direccion text, p_barrio text,
  p_observaciones text, p_items jsonb, p_pago text default 'contra_entrega')
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_vid bigint := privado.vendedora_tienda(p_vendedora);
  v_ip text := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  v_tel text := trim(coalesce(p_telefono, ''));
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s{2,}', ' ', 'g');
  v_linea boolean := coalesce(p_pago, 'contra_entrega') = 'en_linea';
  it jsonb; pr public.productos; v_cant int; v_color text; v_talla text;
  v_items jsonb := '[]'; v_sub numeric := 0; v_dom numeric; v_id bigint; v_dest bigint[]; v_recargo numeric := 0; v_codigo uuid;
begin
  if coalesce(p_pago, 'contra_entrega') not in ('contra_entrega', 'en_linea') then raise exception 'Forma de pago inválida'; end if;
  if p_vendedora is not null and v_vid is null then raise exception 'Este enlace ya no está activo'; end if;
  if v_nombre !~ '\w' or v_nombre ~ '[0-9]' or length(v_nombre) > 80 then raise exception 'Escribe tu nombre (solo letras)'; end if;
  if v_tel !~ '^(3[0-9]{9}|60[0-9]{8}|\+[0-9]{1,4} [0-9]{6,14})$' then raise exception 'Revisa tu número de celular'; end if;
  if length(trim(coalesce(p_direccion, ''))) < 5 then raise exception 'Escribe tu dirección completa'; end if;
  if length(trim(coalesce(p_barrio, ''))) < 2 then raise exception 'Escribe tu barrio'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Tu pedido está vacío'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Son demasiados productos para un solo pedido'; end if;

  if (select count(*) from public.pedidos_web where cliente_telefono = v_tel and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Ya recibimos varios pedidos de este número hoy. Escríbenos por WhatsApp para ayudarte.';
  end if;
  if v_ip <> '' and (select count(*) from public.pedidos_web where ip = v_ip and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Se enviaron muchos pedidos desde esta conexión. Intenta más tarde.';
  end if;
  if (select count(*) from public.pedidos_web where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Estamos recibiendo muchos pedidos. Intenta en unos minutos.';
  end if;

  for it in select x from jsonb_array_elements(p_items) x loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint and activo;
    if not found then raise exception 'Uno de los productos ya no está disponible. Revisa tu pedido.'; end if;
    v_cant := coalesce((it->>'cantidad')::int, 0);
    if v_cant < 1 or v_cant > 20 then raise exception 'Revisa la cantidad de %', pr.nombre; end if;
    if pr.controla_stock and pr.stock <= 0 then raise exception '% está agotado', pr.nombre; end if;
    if pr.controla_stock and v_cant > pr.stock then raise exception 'De % solo quedan %', pr.nombre, pr.stock; end if;
    v_color := nullif(left(trim(coalesce(it->>'color', '')), 40), '');
    v_talla := nullif(left(trim(coalesce(it->>'talla', '')), 40), '');
    if exists (select 1 from public.producto_colores c where c.producto_id = pr.id)
       and not exists (select 1 from public.producto_colores c where c.producto_id = pr.id and c.nombre = v_color) then
      raise exception 'Elige el color de %', pr.nombre;
    end if;
    if cardinality(coalesce(pr.tallas, '{}')) > 0 and not (v_talla = any (pr.tallas)) then
      raise exception 'Elige la talla de %', pr.nombre;
    end if;
    v_items := v_items || jsonb_build_object('producto_id', pr.id, 'nombre', pr.nombre, 'cantidad', v_cant,
      'precio', pr.precio_venta, 'color', v_color, 'talla', v_talla);
    v_sub := v_sub + pr.precio_venta * v_cant;
  end loop;

  select domicilio into v_dom from public.tarifas_domicilio where activo and privado.barrio_normal(barrio) = privado.barrio_normal(p_barrio) limit 1;
  if v_linea then
    if v_dom is null then raise exception 'Para pagar en línea elige tu barrio de la lista. Si no está, elige pagar al recibir.'; end if;
    v_recargo := round((v_sub + v_dom) * 0.05);
  end if;

  insert into public.pedidos_web (vendedora_id, cliente_nombre, cliente_telefono, direccion, barrio, observaciones,
    valor_domicilio, domicilio_por_confirmar, items, subtotal, ip, estado, pago, recargo, pago_estado)
  values (v_vid, v_nombre, v_tel, left(trim(p_direccion), 200), left(trim(p_barrio), 120), nullif(left(trim(coalesce(p_observaciones, '')), 300), ''),
    coalesce(v_dom, 0), v_dom is null, v_items, v_sub, nullif(v_ip, ''),
    case when v_linea then 'por_pagar' else 'por_confirmar' end, case when v_linea then 'en_linea' else 'contra_entrega' end,
    v_recargo, case when v_linea then 'pendiente' end)
  returning id, codigo into v_id, v_codigo;

  -- El pedido que se paga en línea avisa cuando el pago se aprueba
  if not v_linea then
    v_dest := case when v_vid is null then privado.con_rol(array['admin']) else array[v_vid] end;
    perform privado.avisar(v_dest, 'pedido_web', 'Pedido de la tienda: ' || split_part(v_nombre, ' ', 1) || ' · ' || privado.pesos(v_sub + coalesce(v_dom, 0)),
      'Llama al cliente y confírmalo · ' || trim(p_barrio), '/app/pedidos-web', null);
  end if;

  return jsonb_build_object('id', v_id, 'codigo', v_codigo, 'subtotal', v_sub, 'domicilio', coalesce(v_dom, 0),
    'domicilio_por_confirmar', v_dom is null, 'recargo', v_recargo, 'pago', case when v_linea then 'en_linea' else 'contra_entrega' end);
end $function$;
revoke all on function public.tienda_pedir(bigint, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.tienda_pedir(bigint, text, text, text, text, text, jsonb, text) to anon, authenticated;

-- ================================================================ 4. Estado del pago (página de regreso del cliente)
create or replace function public.tienda_pago(p_codigo uuid)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('id', w.id, 'estado', w.estado, 'pago', w.pago, 'pago_estado', w.pago_estado, 'pago_metodo', w.pago_metodo,
    'subtotal', w.subtotal, 'domicilio', w.valor_domicilio, 'recargo', w.recargo, 'total', w.subtotal + w.valor_domicilio + w.recargo,
    'cliente', split_part(w.cliente_nombre, ' ', 1), 'items', w.items, 'vendedora', u.nombre, 'vendedora_id', w.vendedora_id)
  from public.pedidos_web w left join public.usuarios u on u.id = w.vendedora_id
  where w.codigo = p_codigo
$$;
grant execute on function public.tienda_pago(uuid) to anon, authenticated;

-- El cliente prefiere pagar al recibir (si el pago en línea no le funcionó)
create or replace function public.tienda_pagar_al_recibir(p_codigo uuid)
returns void language plpgsql security definer set search_path to '' as $function$
declare w public.pedidos_web; v_dest bigint[];
begin
  select * into w from public.pedidos_web where codigo = p_codigo for update;
  if not found then raise exception 'Ese pedido no existe'; end if;
  if w.pago_estado = 'aprobado' then raise exception 'Este pedido ya está pagado'; end if;
  if w.estado <> 'por_pagar' and not (w.estado = 'cancelado' and w.motivo = 'No se completó el pago en línea') then
    raise exception 'Este pedido ya no se puede cambiar';
  end if;
  update public.pedidos_web set estado = 'por_confirmar', pago = 'contra_entrega', recargo = 0, pago_estado = null, motivo = null, created_at = now()
   where id = w.id;
  v_dest := case when w.vendedora_id is null then privado.con_rol(array['admin']) else array[w.vendedora_id] end;
  perform privado.avisar(v_dest, 'pedido_web', 'Pedido de la tienda: ' || split_part(w.cliente_nombre, ' ', 1) || ' · ' || privado.pesos(w.subtotal + w.valor_domicilio),
    'Llama al cliente y confírmalo · ' || w.barrio, '/app/pedidos-web', null);
end $function$;
grant execute on function public.tienda_pagar_al_recibir(uuid) to anon, authenticated;

-- ================================================================ 5. Wompi (solo el servidor)
-- Guarda el link de pago creado
create or replace function public.wompi_guardar_link(p_codigo uuid, p_link text, p_vence timestamptz)
returns void language sql security definer set search_path to '' as $$
  update public.pedidos_web set wompi_link = p_link, wompi_link_vence = p_vence where codigo = p_codigo
$$;

-- Registra el resultado de una transacción (llega del evento de Wompi o de la verificación al regresar)
create or replace function public.wompi_registrar(p_link text, p_tx text, p_estado text, p_centavos bigint, p_metodo text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare w public.pedidos_web; v_total numeric; v_dest bigint[];
begin
  select * into w from public.pedidos_web where wompi_link = p_link for update;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'link desconocido'); end if;
  if w.pago_estado = 'aprobado' then return jsonb_build_object('ok', true, 'ya', true); end if;
  v_total := w.subtotal + w.valor_domicilio + w.recargo;
  if p_estado = 'APPROVED' then
    if p_centavos < round(v_total * 100) then
      perform privado.avisar(privado.con_rol(array['admin']), 'pedido_web', 'Pago en línea incompleto · pedido web #' || w.id,
        'Wompi aprobó ' || privado.pesos(p_centavos / 100.0) || ' y el pedido vale ' || privado.pesos(v_total) || '. Revísalo.', '/app/pedidos-web', null);
      return jsonb_build_object('ok', false, 'motivo', 'monto');
    end if;
    update public.pedidos_web set pago_estado = 'aprobado', wompi_tx = p_tx, pago_metodo = p_metodo, pagado_at = now(),
      estado = case when estado in ('por_pagar', 'cancelado') then 'por_confirmar' else estado end,
      motivo = case when estado = 'cancelado' then null else motivo end, created_at = case when estado in ('por_pagar', 'cancelado') then now() else created_at end
     where id = w.id;
    v_dest := case when w.vendedora_id is null then privado.con_rol(array['admin']) else array[w.vendedora_id] || privado.con_rol(array['admin']) end;
    perform privado.avisar(v_dest, 'pedido_web', '💳 Pedido PAGADO de la tienda: ' || split_part(w.cliente_nombre, ' ', 1) || ' · ' || privado.pesos(w.subtotal + w.valor_domicilio),
      'Ya pagó en línea. Llama al cliente para coordinar el envío · ' || w.barrio, '/app/pedidos-web', null);
    return jsonb_build_object('ok', true);
  elsif p_estado in ('DECLINED', 'ERROR', 'VOIDED') then
    update public.pedidos_web set pago_estado = 'rechazado', wompi_tx = p_tx where id = w.id and pago_estado is distinct from 'aprobado';
    return jsonb_build_object('ok', true);
  end if;
  return jsonb_build_object('ok', true, 'pendiente', true);
end $function$;
revoke all on function public.wompi_guardar_link(uuid, text, timestamptz), public.wompi_registrar(text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.wompi_guardar_link(uuid, text, timestamptz), public.wompi_registrar(text, text, text, bigint, text) to service_role;

-- Los que no pagaron en 90 minutos se cancelan solos
create or replace function privado.cancelar_sin_pago()
returns void language sql security definer set search_path to '' as $$
  update public.pedidos_web set estado = 'cancelado', motivo = 'No se completó el pago en línea', atendido_por = 'Automático', atendido_at = now()
   where estado = 'por_pagar' and created_at < now() - interval '90 minutes'
$$;
select cron.schedule('pedidos-web-sin-pago', '*/15 * * * *', 'select privado.cancelar_sin_pago()');

-- ================================================================ 6. Lista, confirmar y cancelar en Pedidos de la tienda
do $$
declare v text;
begin
  -- La lista muestra la forma de pago y no muestra los que esperan el pago
  v := pg_get_functiondef('public.pedidos_web_lista()'::regprocedure);
  if position('''riesgo'', case' in v) > 0 and position('pago_estado' in v) = 0 then
    v := replace(v, '''riesgo'', case', '''pago'', w.pago, ''pago_estado'', w.pago_estado, ''pago_metodo'', w.pago_metodo, ''recargo'', w.recargo, ''pagado_at'', w.pagado_at,
      ''riesgo'', case');
    v := replace(v, 'where (v_admin or w.vendedora_id = v_yo)', 'where (v_admin or w.vendedora_id = v_yo) and w.estado <> ''por_pagar''');
    if position('por_pagar' in v) = 0 then raise exception 'No se pudo cambiar pedidos_web_lista'; end if;
    execute v;
  end if;

  -- Al confirmar un pedido pagado: el domicilio queda el que pagó y el pedido sale marcado como pagado
  v := pg_get_functiondef('public.confirmar_pedido_web(bigint,numeric,text,boolean)'::regprocedure);
  if position('pagado_linea' in v) = 0 then
    v := replace(v, 'v_dom := coalesce(p_domicilio, w.valor_domicilio);',
      'v_dom := case when w.pago_estado = ''aprobado'' then w.valor_domicilio else coalesce(p_domicilio, w.valor_domicilio) end;');
    v := replace(v, 'update public.pedidos set total = v_sub + v_dom where id = v_id;',
      'update public.pedidos set total = v_sub + v_dom,
     pagado_linea = case when w.pago_estado = ''aprobado'' then v_sub + v_dom end, wompi_tx = case when w.pago_estado = ''aprobado'' then w.wompi_tx end
   where id = v_id;
  if w.pago_estado = ''aprobado'' then
    perform public.nota(v_id, ''Pagado en línea con Wompi ('' || coalesce(w.pago_metodo, '''') || ''): '' || privado.pesos(v_sub + v_dom) || ''. No se le cobra al entregar.'');
  end if;');
    if position('pagado_linea' in v) = 0 or position('w.pago_estado = ''aprobado'' then w.valor_domicilio' in v) = 0 then raise exception 'No se pudo cambiar confirmar_pedido_web'; end if;
    execute v;
  end if;

  -- Al entregar un pedido pagado en línea no se cobra ni se pide comprobante
  v := pg_get_functiondef('public.entregar_pedido(bigint,text,numeric,numeric,text[],numeric)'::regprocedure);
  if position('pagado_linea' in v) = 0 then
    v := replace(v, '  if p_tipo not in (''efectivo'',''transferencia'',''mixto'') then raise exception ''Forma de pago inválida''; end if;',
      '  if p.pagado_linea is not null and p.pagado_linea >= p.total then p_tipo := ''transferencia''; p_propina := 0; v_prop := 0; end if;
  if p_tipo not in (''efectivo'',''transferencia'',''mixto'') then raise exception ''Forma de pago inválida''; end if;');
    v := replace(v, 'if p_tipo in (''transferencia'', ''mixto'') and cardinality(v_ev) = 0 then',
      'if p_tipo in (''transferencia'', ''mixto'') and cardinality(v_ev) = 0
     and not (p.pagado_linea is not null and (p_tipo = ''transferencia'' and p.pagado_linea >= p.total or p_tipo = ''mixto'' and coalesce(p_transferencia, 0) <= p.pagado_linea)) then');
    v := replace(v, '''Entregado · '' || p_tipo', '''Entregado · '' || case when p.pagado_linea is not null then ''pagado en línea'' || case when p_tipo = ''mixto'' then '' + efectivo'' else '''' end else p_tipo end');
    if position('p.pagado_linea >= p.total then p_tipo' in v) = 0 or position('coalesce(p_transferencia, 0) <= p.pagado_linea' in v) = 0 then raise exception 'No se pudo cambiar entregar_pedido'; end if;
    execute v;
  end if;
end $$;
