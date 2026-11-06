-- Cambio por otro producto más caro: el cliente paga la diferencia (YA APLICADO 2026-11-06)
-- * Lo que devuelve sigue igual (vuelve al inventario o queda dañado).
-- * El producto nuevo sale del inventario (si lo lleva) al precio de venta del catálogo.
-- * Diferencia = precio del nuevo − lo que valía lo devuelto. Si el nuevo vale menos, se usa Devolución.
-- * Si la diferencia se paga en efectivo, entra sola a la caja del local (como entrada).
-- * La ganancia del cambio (diferencia − costo del nuevo + costo de lo devuelto si vuelve bien)
--   suma en la utilidad real (Inicio y Gastos).

alter table public.devoluciones
  add column if not exists nuevo_producto_id bigint references public.productos(id),
  add column if not exists nuevo_nombre text,
  add column if not exists nuevo_cantidad int,
  add column if not exists nuevo_precio numeric,
  add column if not exists nuevo_costo numeric,
  add column if not exists diferencia numeric not null default 0,
  add column if not exists diferencia_metodo text,
  add column if not exists ajuste_ganancia numeric not null default 0;

create or replace function public.registrar_cambio_otro(p_pedido bigint, p_items jsonb, p_motivo text, p_estado_producto text,
  p_producto_nuevo bigint, p_cantidad_nuevo int, p_metodo text, p_nota text, p_fotos text[])
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; pr public.productos; v_valor numeric; v_costo_dev numeric; v_cant int := coalesce(p_cantidad_nuevo, 0);
  v_total numeric; v_dif numeric; v_ajuste numeric; v_caja boolean := false;
begin
  if not privado.puede_devoluciones() then raise exception 'No tienes permiso para registrar cambios'; end if;
  if v_cant <= 0 then raise exception 'Escribe cuántas unidades del producto nuevo'; end if;
  if coalesce(p_metodo, '') not in ('efectivo', 'transferencia', 'otro') then raise exception 'Elige cómo pagó la diferencia'; end if;
  select * into pr from public.productos where id = p_producto_nuevo and activo for update;
  if not found then raise exception 'El producto nuevo no existe'; end if;
  if pr.controla_stock and pr.stock < v_cant then raise exception 'Solo quedan % de %', greatest(pr.stock, 0), pr.nombre; end if;

  -- Lo que devuelve: igual que un cambio normal, sin entregar otro igual
  v_id := public.registrar_devolucion(p_pedido, p_items, 'cambio', p_motivo, p_estado_producto, false, 0, null, false, p_nota, p_fotos);
  select coalesce(sum(precio_venta * cantidad), 0), coalesce(sum(precio_compra * cantidad), 0) into v_valor, v_costo_dev
    from public.devolucion_items where devolucion_id = v_id;
  -- Se vuelve a leer: si lo que regresa es el mismo producto, su stock ya cambió
  select * into pr from public.productos where id = p_producto_nuevo;

  v_total := coalesce(pr.precio_venta, 0) * v_cant;
  v_dif := v_total - v_valor;
  if v_dif < 0 then raise exception 'El producto nuevo vale menos (% vs %): para eso usa Devolución', privado.pesos(v_total), privado.pesos(v_valor); end if;
  v_ajuste := v_dif - coalesce(pr.precio_compra, 0) * v_cant + case when p_estado_producto = 'vuelve_stock' then v_costo_dev else 0 end;

  if pr.controla_stock then
    update public.productos set stock = stock - v_cant, updated_at = now() where id = pr.id;
    insert into public.inventario_movimientos (producto_id, tipo, cantidad, stock_antes, stock_despues, motivo, autor)
    values (pr.id, 'ajuste', -v_cant, pr.stock, pr.stock - v_cant, 'Cambio del pedido #' || p_pedido, public.mi_nombre());
  end if;

  update public.devoluciones set nuevo_producto_id = pr.id, nuevo_nombre = pr.nombre, nuevo_cantidad = v_cant, nuevo_precio = pr.precio_venta,
    nuevo_costo = coalesce(pr.precio_compra, 0), diferencia = v_dif, diferencia_metodo = case when v_dif > 0 then p_metodo end, ajuste_ganancia = v_ajuste
   where id = v_id;

  -- La diferencia en efectivo entra a la caja del local
  if v_dif > 0 and p_metodo = 'efectivo' and privado.puede_caja() then
    -- Si la caja de hoy ya se entregó y recibió, no se puede: el cambio queda igual
    begin
      perform public.caja_movimiento('entrada', 'Diferencia por cambio #' || p_pedido, v_dif, v_cant || ' ' || pr.nombre, '{}');
      v_caja := true;
    exception when others then null;
    end;
  end if;

  perform public.nota(p_pedido, 'Cambio por ' || v_cant || ' ' || pr.nombre
    || case when v_dif > 0 then ' · el cliente pagó ' || privado.pesos(v_dif) || ' de diferencia (' || p_metodo || ')' else ' · sin diferencia' end);
  return jsonb_build_object('id', v_id, 'diferencia', v_dif, 'valor_devuelto', v_valor, 'total_nuevo', v_total, 'en_caja', v_caja);
end $function$;
revoke execute on function public.registrar_cambio_otro(bigint, jsonb, text, text, bigint, int, text, text, text[]) from public, anon;
grant execute on function public.registrar_cambio_otro(bigint, jsonb, text, text, bigint, int, text, text, text[]) to authenticated;

do $$
declare v text;
begin
  -- Devoluciones: mostrar el producto nuevo y la diferencia
  v := replace(pg_get_functiondef('public.devoluciones_lista(date,date)'::regprocedure), chr(13), '');
  if position('nuevo_nombre' in v) = 0 then
    v := replace(v, '''tecnico'', dv.tecnico,', '''nuevo_nombre'', dv.nuevo_nombre, ''nuevo_cantidad'', dv.nuevo_cantidad, ''diferencia'', dv.diferencia,
        ''diferencia_metodo'', dv.diferencia_metodo, ''tecnico'', dv.tecnico,');
    if position('nuevo_nombre' in v) = 0 then raise exception 'No se pudo cambiar devoluciones_lista'; end if;
    execute v;
  end if;

  -- Utilidad real: suma la ganancia de los cambios por otro producto
  v := replace(pg_get_functiondef('public.gastos_resumen(date,date)'::regprocedure), chr(13), '');
  if position('ganancia_cambios' in v) = 0 then
    v := replace(v, 'v_cuentas numeric;', 'v_cuentas numeric; v_cambios numeric;');
    v := replace(v, '  select coalesce(sum(valor), 0) into v_gastos', '  select coalesce(sum(ajuste_ganancia), 0) into v_cambios from public.devoluciones
   where nuevo_producto_id is not null and created_at >= d and created_at < h;
  select coalesce(sum(valor), 0) into v_gastos');
    v := replace(v, '''utilidad'', v_gan + v_cuentas - v_gastos,', '''ganancia_cambios'', v_cambios,
    ''utilidad'', v_gan + v_cuentas + v_cambios - v_gastos,');
    if position('''ganancia_cambios''' in v) = 0 or position('into v_cambios' in v) = 0 then raise exception 'No se pudo cambiar gastos_resumen'; end if;
    execute v;
  end if;
end $$;
