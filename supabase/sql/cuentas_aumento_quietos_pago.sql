-- Cuentas por cobrar con aumento, productos quietos y seguimiento en la página del pago (YA APLICADO 2026-11-05)
--
-- 1) Cuentas por cobrar: a una cuenta se le puede vender por encima del costo. Cada producto guarda
--    tu costo real (costo_real) y lo que le cobras (costo). La diferencia es ganancia tuya y suma en
--    Inicio y en Gastos (utilidad real). Las entregas viejas quedan con ganancia 0 (eran al costo).
-- 2) Productos quietos: los activos (sin los agotados) que llevan X días sin venderse; si llevan conteo de
--    unidades, la plata que hay ahí (unidades × costo).
-- 3) La página del pago en línea trae el enlace de seguimiento cuando el pedido ya está confirmado.

alter table public.cuentas_cobrar add column if not exists aumento numeric not null default 0 check (aumento >= 0 and aumento <= 300);
alter table public.cuenta_entrega_items add column if not exists costo_real numeric;
update public.cuenta_entrega_items set costo_real = costo where costo_real is null;
alter table public.cuenta_entrega_items alter column costo_real set not null;

-- Guardar cuenta con su aumento (%)
drop function if exists public.guardar_cuenta(bigint, text, text);
create or replace function public.guardar_cuenta(p_cuenta bigint, p_nombre text, p_telefono text, p_aumento numeric default 0)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_nombre text := privado.limpio(p_nombre, 80); v_aum numeric := round(coalesce(p_aumento, 0), 1);
begin
  perform privado.solo_admin_cuentas();
  if v_nombre is null or length(v_nombre) < 2 then raise exception 'Escribe el nombre'; end if;
  if v_aum < 0 or v_aum > 300 then raise exception 'El aumento va de 0%% a 300%%'; end if;
  if p_cuenta is null then
    insert into public.cuentas_cobrar (nombre, telefono, aumento) values (v_nombre, privado.limpio(p_telefono, 20), v_aum) returning id into v_id;
  else
    update public.cuentas_cobrar set nombre = v_nombre, telefono = privado.limpio(p_telefono, 20), aumento = v_aum where id = p_cuenta returning id into v_id;
    if v_id is null then raise exception 'Esa cuenta no existe'; end if;
  end if;
  return v_id;
end $function$;
revoke execute on function public.guardar_cuenta(bigint, text, text, numeric) from public, anon;
grant execute on function public.guardar_cuenta(bigint, text, text, numeric) to authenticated;

do $$
declare v text;
begin
  -- Entregar: cada producto con tu costo real (costo_real) y lo que le cobras (costo)
  foreach v in array array['public.entregar_al_costo(bigint,jsonb,date,text)', 'public.editar_entrega_costo(bigint,jsonb,date,text)'] loop
    v := replace(pg_get_functiondef(v::regprocedure), chr(13), '');
    if position('costo_real' in v) = 0 then
      v := replace(v, 'v_costo numeric;', 'v_costo numeric; v_real numeric;');
      v := replace(v, '    if v_costo < 0 then raise exception ''Revisa el costo de %'', pr.nombre; end if;',
        '    if v_costo < 0 then raise exception ''Revisa el costo de %'', pr.nombre; end if;
    v_real := round(coalesce((it->>''costo_real'')::numeric, pr.precio_compra, v_costo, 0));
    if v_real < 0 then raise exception ''Revisa tu costo de %'', pr.nombre; end if;');
      v := replace(v, 'cantidad, costo) values (v_id, pr.id, pr.nombre, v_cant, v_costo);', 'cantidad, costo, costo_real) values (v_id, pr.id, pr.nombre, v_cant, v_costo, v_real);');
      v := replace(v, 'cantidad, costo)
    values (e.id, pr.id, coalesce(nullif(trim(it->>''nombre''), ''''), pr.nombre), v_cant, v_costo);',
        'cantidad, costo, costo_real)
    values (e.id, pr.id, coalesce(nullif(trim(it->>''nombre''), ''''), pr.nombre), v_cant, v_costo, v_real);');
      if position('v_cant, v_costo, v_real)' in v) = 0 then raise exception 'No se pudo cambiar la entrega: %', left(v, 60); end if;
      execute v;
    end if;
  end loop;

  -- Lista y detalle con aumento y ganancia
  v := replace(pg_get_functiondef('public.cuentas_lista()'::regprocedure), chr(13), '');
  if position('ganancia' in v) = 0 then
    v := replace(v, '''nombre'', c.nombre, ''telefono'', c.telefono,', '''nombre'', c.nombre, ''telefono'', c.telefono, ''aumento'', c.aumento, ''ganancia'', g.total,');
    v := replace(v, '    where c.activa) s)', '    cross join lateral (select coalesce(sum(i.cantidad * (i.costo - i.costo_real)), 0) total from public.cuenta_entrega_items i
                        join public.cuenta_entregas ce on ce.id = i.entrega_id where ce.cuenta_id = c.id) g
    where c.activa) s)');
    if position('g.total' in v) = 0 or position('join public.cuenta_entregas ce' in v) = 0 then raise exception 'No se pudo cambiar cuentas_lista'; end if;
    execute v;
  end if;

  v := replace(pg_get_functiondef('public.cuenta_detalle(bigint)'::regprocedure), chr(13), '');
  if position('costo_real' in v) = 0 then
    v := replace(v, '''telefono'', c.telefono,', '''telefono'', c.telefono, ''aumento'', c.aumento,');
    v := replace(v, '''cantidad'', i.cantidad, ''costo'', i.costo)', '''cantidad'', i.cantidad, ''costo'', i.costo, ''costo_real'', i.costo_real)');
    v := replace(v, '''quien'', e.creado_por_nombre,
        ''items''', '''quien'', e.creado_por_nombre,
        ''ganancia'', (select coalesce(sum(i.cantidad * (i.costo - i.costo_real)), 0) from public.cuenta_entrega_items i where i.entrega_id = e.id),
        ''items''');
    if position('''costo_real'', i.costo_real' in v) = 0 or position('''ganancia''' in v) = 0 then raise exception 'No se pudo cambiar cuenta_detalle'; end if;
    execute v;
  end if;

  -- Utilidad real (Inicio y Gastos): suma la ganancia de las cuentas por cobrar del periodo
  v := replace(pg_get_functiondef('public.gastos_resumen(date,date)'::regprocedure), chr(13), '');
  if position('ganancia_cuentas' in v) = 0 then
    v := replace(v, 'v_gan numeric; v_gastos numeric;', 'v_gan numeric; v_gastos numeric; v_cuentas numeric;');
    v := replace(v, '  select coalesce(sum(valor), 0) into v_gastos', '  select coalesce(sum(i.cantidad * (i.costo - i.costo_real)), 0) into v_cuentas
    from public.cuenta_entrega_items i join public.cuenta_entregas e on e.id = i.entrega_id
   where e.fecha between p_desde and p_hasta;
  select coalesce(sum(valor), 0) into v_gastos');
    v := replace(v, '''utilidad'', v_gan - v_gastos,', '''ganancia_cuentas'', v_cuentas,
    ''utilidad'', v_gan + v_cuentas - v_gastos,');
    if position('''ganancia_cuentas''' in v) = 0 or position('into v_cuentas' in v) = 0 then raise exception 'No se pudo cambiar gastos_resumen'; end if;
    execute v;
  end if;
end $$;

-- Productos quietos: activos, no agotados y sin venderse hace p_dias o más (pedidos entregados, ventas del
-- local y entregas de cuentas por cobrar). Si nunca se ha vendido, cuenta desde que se creó.
create or replace function public.productos_quietos(p_dias int default 30)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_hoy timestamptz := now();
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'plata')::numeric desc, (x->>'dias')::int desc) from (
    select jsonb_build_object('id', p.id, 'nombre', p.nombre, 'sku', p.sku, 'imagen_url', p.imagen_url, 'categoria', p.categoria,
      'stock', case when p.controla_stock then p.stock end, 'costo', p.precio_compra, 'precio', p.precio_venta,
      'plata', case when p.controla_stock and p.stock > 0 then p.stock * coalesce(p.precio_compra, 0) else 0 end,
      'ultima_venta', u.ultima, 'nunca', u.ultima is null,
      'dias', floor(extract(epoch from v_hoy - coalesce(u.ultima, p.created_at)) / 86400)::int,
      'vendidas_90', coalesce(n.n, 0)) x
    from public.productos p
    cross join lateral (select greatest(
        (select max(coalesce(pe.entregado_at, pe.created_at)) from public.pedido_items i join public.pedidos pe on pe.id = i.pedido_id
          where i.producto_id = p.id and pe.estado = 'entregado'),
        (select max(ce.fecha::timestamp at time zone 'America/Bogota') from public.cuenta_entrega_items i join public.cuenta_entregas ce on ce.id = i.entrega_id
          where i.producto_id = p.id)) ultima) u
    cross join lateral (select sum(i.cantidad) n from public.pedido_items i join public.pedidos pe on pe.id = i.pedido_id
          where i.producto_id = p.id and pe.estado = 'entregado' and coalesce(pe.entregado_at, pe.created_at) > v_hoy - interval '90 days') n
    where p.activo and not (p.controla_stock and p.stock <= 0)
      and coalesce(u.ultima, p.created_at) < v_hoy - make_interval(days => greatest(coalesce(p_dias, 30), 1))) s), '[]');
end $function$;
revoke execute on function public.productos_quietos(int) from public, anon;
grant execute on function public.productos_quietos(int) to authenticated;

-- Página del pago: el enlace de seguimiento cuando el pedido ya está confirmado
create or replace function public.tienda_pago(p_codigo uuid)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object('id', w.id, 'estado', w.estado, 'pago', w.pago, 'pago_estado', w.pago_estado, 'pago_metodo', w.pago_metodo,
    'subtotal', w.subtotal, 'domicilio', w.valor_domicilio, 'recargo', w.recargo, 'total', w.subtotal + w.valor_domicilio + w.recargo,
    'cliente', split_part(w.cliente_nombre, ' ', 1), 'items', w.items, 'vendedora', u.nombre, 'vendedora_id', w.vendedora_id,
    'vendedora_telefono', u.telefono, 'seguimiento', pe.seguimiento, 'pedido_id', w.pedido_id,
    'telefonos', (select c.telefonos from public.configuracion c limit 1))
  from public.pedidos_web w left join public.usuarios u on u.id = w.vendedora_id
  left join public.pedidos pe on pe.id = w.pedido_id
  where w.codigo = p_codigo
$function$;
grant execute on function public.tienda_pago(uuid) to anon, authenticated;

-- Arreglo (YA APLICADO): al editar una entrega salía "column reference pr.id is ambiguous" porque la
-- función tiene una variable llamada pr y el update de productos usaba el mismo alias.
do $$
declare v text := replace(pg_get_functiondef('public.editar_entrega_costo(bigint,jsonb,date,text)'::regprocedure), chr(13), '');
begin
  if position('productos px' in v) = 0 then
    v := replace(v, 'update public.productos pr set stock = pr.stock + i.cantidad, updated_at = now()
    from public.cuenta_entrega_items i where i.entrega_id = e.id and i.producto_id = pr.id and pr.controla_stock;',
      'update public.productos px set stock = px.stock + i.cantidad, updated_at = now()
    from public.cuenta_entrega_items i where i.entrega_id = e.id and i.producto_id = px.id and px.controla_stock;');
    if position('productos px' in v) = 0 then raise exception 'No se pudo cambiar editar_entrega_costo'; end if;
    execute v;
  end if;
end $$;
