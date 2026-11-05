-- Cupones de descuento en el catálogo y "Lo más vendido" (YA APLICADO 2026-11-05)
-- El descuento del cupón se reparte en los precios de los productos del pedido (así el pedido, las
-- comisiones y los reportes cuadran sin cambios) y queda guardado qué cupón se usó y cuánto descontó.

create table if not exists public.cupones (
  id bigint generated always as identity primary key,
  codigo text not null unique check (codigo ~ '^[A-Z0-9_-]{3,30}$'),
  descripcion text,
  tipo text not null check (tipo in ('porcentaje', 'valor')),
  valor numeric not null check (valor > 0),
  minimo numeric not null default 0 check (minimo >= 0),
  usos_max int check (usos_max is null or usos_max > 0),
  usos int not null default 0,
  vence date,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.cupones enable row level security;
revoke all on public.cupones from anon, authenticated;

alter table public.pedidos_web
  add column if not exists cupon text,
  add column if not exists descuento numeric not null default 0;

-- Descuento que da un cupón sobre un subtotal (o el motivo por el que no sirve)
create or replace function privado.descuento_cupon(p_codigo text, p_subtotal numeric)
returns numeric language plpgsql stable security definer set search_path to '' as $function$
declare c public.cupones; v numeric;
begin
  select * into c from public.cupones where codigo = upper(trim(coalesce(p_codigo, '')));
  if not found or not c.activo then raise exception 'Ese cupón no existe'; end if;
  if c.vence is not null and c.vence < (now() at time zone 'America/Bogota')::date then raise exception 'Ese cupón ya venció'; end if;
  if c.usos_max is not null and c.usos >= c.usos_max then raise exception 'Ese cupón ya se usó todas las veces'; end if;
  if coalesce(p_subtotal, 0) < c.minimo then raise exception 'Ese cupón es para compras desde %', privado.pesos(c.minimo); end if;
  v := case when c.tipo = 'porcentaje' then round(p_subtotal * least(c.valor, 90) / 100) else least(c.valor, p_subtotal) end;
  return greatest(v, 0);
end $function$;
revoke execute on function privado.descuento_cupon(text, numeric) from public, anon, authenticated;

-- El catálogo valida el cupón mientras el cliente arma el pedido
create or replace function public.tienda_cupon(p_codigo text, p_subtotal numeric)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare c public.cupones;
begin
  select * into c from public.cupones where codigo = upper(trim(coalesce(p_codigo, '')));
  return jsonb_build_object('codigo', c.codigo, 'tipo', c.tipo, 'valor', c.valor, 'minimo', c.minimo, 'descripcion', c.descripcion,
    'descuento', privado.descuento_cupon(p_codigo, p_subtotal));
end $function$;
grant execute on function public.tienda_cupon(text, numeric) to anon, authenticated;

-- Admin: cupones
create or replace function public.cupones_lista()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'descontado', (select coalesce(sum(w.descuento), 0) from public.pedidos_web w where w.cupon = c.codigo and w.estado <> 'cancelado'),
      'pedidos', (select count(*) from public.pedidos_web w where w.cupon = c.codigo and w.estado <> 'cancelado'))
    order by c.activo desc, c.created_at desc) from public.cupones c), '[]');
end $function$;

create or replace function public.guardar_cupon(p_id bigint, p_codigo text, p_descripcion text, p_tipo text, p_valor numeric,
  p_minimo numeric, p_usos_max int, p_vence date, p_activo boolean)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_id bigint; v_cod text := upper(regexp_replace(trim(coalesce(p_codigo, '')), '\s+', '', 'g'));
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  if v_cod !~ '^[A-Z0-9_-]{3,30}$' then raise exception 'El código va de 3 a 30 letras o números, sin espacios'; end if;
  if p_tipo not in ('porcentaje', 'valor') then raise exception 'Elige si es porcentaje o valor'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Escribe el descuento'; end if;
  if p_tipo = 'porcentaje' and p_valor > 90 then raise exception 'El porcentaje máximo es 90%%'; end if;
  if p_id is null then
    insert into public.cupones (codigo, descripcion, tipo, valor, minimo, usos_max, vence, activo)
    values (v_cod, privado.limpio(p_descripcion, 120), p_tipo, round(p_valor), greatest(coalesce(p_minimo, 0), 0), p_usos_max, p_vence, coalesce(p_activo, true))
    returning id into v_id;
  else
    update public.cupones set codigo = v_cod, descripcion = privado.limpio(p_descripcion, 120), tipo = p_tipo, valor = round(p_valor),
      minimo = greatest(coalesce(p_minimo, 0), 0), usos_max = p_usos_max, vence = p_vence, activo = coalesce(p_activo, true)
     where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Ese cupón no existe'; end if;
  end if;
  return v_id;
exception when unique_violation then raise exception 'Ya hay un cupón con el código %', v_cod;
end $function$;

create or replace function public.eliminar_cupon(p_id bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  delete from public.cupones where id = p_id;
end $function$;

revoke execute on function public.cupones_lista(), public.guardar_cupon(bigint, text, text, text, numeric, numeric, int, date, boolean), public.eliminar_cupon(bigint) from public, anon;
grant execute on function public.cupones_lista(), public.guardar_cupon(bigint, text, text, text, numeric, numeric, int, date, boolean), public.eliminar_cupon(bigint) to authenticated;

-- Pedir desde el catálogo con cupón (nuevo parámetro p_cupon)
do $$
declare v text := pg_get_functiondef('public.tienda_pedir(bigint,text,text,text,text,text,jsonb,text)'::regprocedure);
begin
  v := replace(v, 'p_pago text DEFAULT ''contra_entrega''::text)', 'p_pago text DEFAULT ''contra_entrega''::text, p_cupon text DEFAULT NULL::text)');
  v := replace(v, 'v_recargo numeric := 0; v_codigo uuid;', 'v_recargo numeric := 0; v_codigo uuid; v_desc numeric := 0; v_sub2 numeric; v_cupon text;');
  v := replace(v, '  select domicilio into v_dom from public.tarifas_domicilio',
'  -- Cupón: el descuento se reparte en los precios de los productos
  if nullif(trim(coalesce(p_cupon, '''')), '''') is not null then
    v_cupon := upper(trim(p_cupon));
    v_desc := privado.descuento_cupon(v_cupon, v_sub);
    if v_desc > 0 then
      select jsonb_agg(x || jsonb_build_object(''precio'', round((x->>''precio'')::numeric * (v_sub - v_desc) / v_sub), ''precio_lista'', (x->>''precio'')::numeric) order by n)
        into v_items from jsonb_array_elements(v_items) with ordinality t(x, n);
      select sum((x->>''precio'')::numeric * (x->>''cantidad'')::int) into v_sub2 from jsonb_array_elements(v_items) x;
      v_desc := v_sub - v_sub2;
      v_sub := v_sub2;
    end if;
    update public.cupones set usos = usos + 1 where codigo = v_cupon;
  end if;

  select domicilio into v_dom from public.tarifas_domicilio');
  v := replace(v, 'items, subtotal, ip, estado, pago, recargo, pago_estado)', 'items, subtotal, ip, estado, pago, recargo, pago_estado, cupon, descuento)');
  v := replace(v, 'v_recargo, case when v_linea then ''pendiente'' end)', 'v_recargo, case when v_linea then ''pendiente'' end, v_cupon, v_desc)');
  v := replace(v, '''recargo'', v_recargo, ''pago'',', '''recargo'', v_recargo, ''descuento'', v_desc, ''cupon'', v_cupon, ''pago'',');
  if position('p_cupon text' in v) = 0 or position('descuento_cupon' in v) = 0 or position('v_cupon, v_desc)' in v) = 0 or position('''descuento'', v_desc' in v) = 0 then
    raise exception 'No se pudo cambiar tienda_pedir';
  end if;
  drop function public.tienda_pedir(bigint, text, text, text, text, text, jsonb, text);
  execute v;
  revoke all on function public.tienda_pedir(bigint, text, text, text, text, text, jsonb, text, text) from public;
  grant execute on function public.tienda_pedir(bigint, text, text, text, text, text, jsonb, text, text) to anon, authenticated;

  -- Pedidos de la tienda: muestran el cupón
  v := pg_get_functiondef('public.pedidos_web_lista()'::regprocedure);
  if position('''cupon''' in v) = 0 then
    v := replace(v, '''recargo'', w.recargo,', '''recargo'', w.recargo, ''cupon'', w.cupon, ''descuento'', w.descuento,');
    if position('''cupon''' in v) = 0 then raise exception 'No se pudo cambiar pedidos_web_lista'; end if;
    execute v;
  end if;

  -- Catálogo: los 10 más vendidos de los últimos 30 días llevan su puesto
  v := pg_get_functiondef('public.tienda(bigint)'::regprocedure);
  if position('''top''' in v) = 0 then
    v := replace(v, 'select i.producto_id, sum(i.cantidad) n from public.pedido_items i join public.pedidos x',
                    'select i.producto_id, sum(i.cantidad) n, rank() over (order by sum(i.cantidad) desc) rk from public.pedido_items i join public.pedidos x');
    v := replace(v, '''disponibles'', case when p.controla_stock then greatest(p.stock, 0) end)',
      '''disponibles'', case when p.controla_stock then greatest(p.stock, 0) end, ''top'', case when v.rk <= 10 then v.rk end)');
    if position('''top''' in v) = 0 or position('rk from' in v) = 0 then raise exception 'No se pudo cambiar tienda'; end if;
    execute v;
  end if;
end $$;
