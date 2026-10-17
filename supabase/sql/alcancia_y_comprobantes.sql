-- Alcancía del punto físico y comprobantes obligatorios.
--  · Cada venta en el local asignada a una vendedora le descuenta un aporte
--    (por defecto $2.000, en configuracion.aporte_alcancia) de su ganancia; ese
--    aporte se guarda en pedidos.aporte_alcancia y suma en la Alcancía. Nunca
--    deja la ganancia en negativo: si gana menos, el aporte es lo que ganó.
--  · La Alcancía tiene retiros (gastos del punto físico) que registra el admin.
--  · Pagos por transferencia o mixtos piden sí o sí la foto del comprobante,
--    tanto al entregar (domiciliario) como en la venta del local. Las fotos van
--    al bucket privado "comprobantes" y se guardan como 'sb://comprobantes/…'.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.

alter table public.pedidos add column if not exists aporte_alcancia numeric not null default 0 check (aporte_alcancia >= 0);
alter table public.configuracion add column if not exists aporte_alcancia numeric not null default 2000 check (aporte_alcancia >= 0 and aporte_alcancia <= 100000);

create table if not exists public.alcancia_retiros (
  id bigint generated always as identity primary key,
  monto numeric not null check (monto > 0),
  concepto text not null check (length(trim(concepto)) between 1 and 200),
  usuario_id bigint references public.usuarios(id),
  usuario_nombre text,
  created_at timestamptz not null default now()
);
alter table public.alcancia_retiros enable row level security;
create policy alcancia_retiros_ver on public.alcancia_retiros for select to authenticated
  using ((select public.tiene_rol('admin')) or (select public.tiene_rol('venta_local')) or (select public.tiene_rol('cuadres')));
-- Los retiros se registran solo con alcancia_retirar() (revisa el saldo)
grant select on public.alcancia_retiros to authenticated;

-- ---------- Comprobantes (bucket privado) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Sube cada quien en su carpeta (su auth.uid) y solo quien cobra
create policy comprobantes_subir on storage.objects for insert to authenticated with check (
  bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text
  and ((select public.tiene_rol('admin')) or (select public.tiene_rol('mensajero')) or (select public.tiene_rol('venta_local')))
);
-- Los ven: quien los subió, admin, cuadres, venta local, y la vendedora o el mensajero del pedido
create policy comprobantes_ver on storage.objects for select to authenticated using (
  bucket_id = 'comprobantes' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.tiene_rol('admin')) or (select public.tiene_rol('cuadres')) or (select public.tiene_rol('venta_local'))
    or exists (select 1 from public.pedidos p where ('sb://comprobantes/' || name) = any (p.evidencias)
               and (p.vendedora_id = (select public.mi_usuario_id()) or p.mensajero_id = (select public.mi_usuario_id())))
  )
);

-- Revisa que los comprobantes sean fotos subidas por quien llama
create or replace function privado.comprobantes_validos(p_rutas text[]) returns text[]
language plpgsql stable security definer set search_path = '' as $fn$
declare r text; v_uid text := (select auth.uid())::text; out text[] := '{}';
begin
  if coalesce(cardinality(p_rutas), 0) > 5 then raise exception 'Máximo 5 fotos de comprobante'; end if;
  foreach r in array coalesce(p_rutas, '{}') loop
    if r !~ ('^sb://comprobantes/' || v_uid || '/[A-Za-z0-9._-]+$') then raise exception 'Comprobante inválido'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'comprobantes' and o.name = substr(r, 19)) then
      raise exception 'No se encontró la foto del comprobante, vuelve a subirla';
    end if;
    out := out || r;
  end loop;
  return out;
end $fn$;
revoke all on function privado.comprobantes_validos(text[]) from public, anon, authenticated;

-- ---------- Entregar (domiciliario) con comprobante ----------
create or replace function public.entregar_pedido(p_pedido bigint, p_tipo text, p_efectivo numeric, p_transferencia numeric, p_evidencias text[])
returns void language plpgsql security definer set search_path = '' as $fn$
declare p public.pedidos; v_yo bigint := public.mi_usuario_id(); v_ev text[];
begin
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if not (public.tiene_rol('admin') or p.mensajero_id = v_yo) then raise exception 'Este pedido no está asignado a ti'; end if;
  if p.estado not in ('despachado','alistado','por_alistar') then raise exception 'El pedido ya está %', lower(public.estado_label(p.estado)); end if;
  if p_tipo not in ('efectivo','transferencia','mixto') then raise exception 'Forma de pago inválida'; end if;
  v_ev := privado.comprobantes_validos(p_evidencias);
  if p_tipo in ('transferencia', 'mixto') and cardinality(v_ev) = 0 then raise exception 'Sube la foto del comprobante de la transferencia'; end if;
  if p_tipo = 'efectivo' then p_efectivo := p.total; p_transferencia := 0;
  elsif p_tipo = 'transferencia' then p_efectivo := 0; p_transferencia := p.total;
  elsif coalesce(p_efectivo,0) + coalesce(p_transferencia,0) <> p.total then
    raise exception 'Efectivo + transferencia debe sumar %', p.total;
  end if;
  update public.pedidos set estado = 'entregado', entregado_at = now(), updated_at = now(),
    tipo_recaudo = p_tipo, valor_efectivo = p_efectivo, valor_transferencia = p_transferencia,
    mensajero_id = coalesce(mensajero_id, v_yo), stock_descontado = true,
    evidencias = case when cardinality(v_ev) > 0 then coalesce(evidencias, '{}') || v_ev else evidencias end
  where id = p_pedido;
  if not p.stock_descontado then
    update public.productos pr set stock = pr.stock - i.cantidad, updated_at = now()
      from public.pedido_items i where i.pedido_id = p.id and i.producto_id = pr.id and pr.controla_stock;
  end if;
  perform public.nota(p_pedido, 'Entregado · ' || p_tipo || case when cardinality(v_ev) > 0 then ' · comprobante adjunto' else '' end);
end $fn$;
-- La versión vieja (sin comprobantes) pasa por la nueva: con transferencia exige foto
create or replace function public.entregar_pedido(p_pedido bigint, p_tipo text, p_efectivo numeric, p_transferencia numeric)
returns void language sql security definer set search_path = '' as $fn$
  select public.entregar_pedido(p_pedido, p_tipo, p_efectivo, p_transferencia, null::text[])
$fn$;
revoke all on function public.entregar_pedido(bigint, text, numeric, numeric, text[]) from public, anon;
grant execute on function public.entregar_pedido(bigint, text, numeric, numeric, text[]) to authenticated;

-- ---------- Venta en el local: comprobante y aporte a la alcancía ----------
create or replace function public.registrar_venta_local(
  p_cliente_nombre text, p_cliente_telefono text, p_observaciones text, p_items jsonb,
  p_tipo text, p_efectivo numeric, p_transferencia numeric, p_vendedora bigint, p_evidencias text[])
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare
  v_yo bigint := public.mi_usuario_id();
  v_admin boolean := public.tiene_rol('admin');
  v_id bigint; v_sub numeric := 0; v_gan numeric := 0; it jsonb; pr record; v_precio numeric; v_cant int;
  v_vend_nombre text; v_yo_nombre text := public.mi_nombre(); v_ev text[]; v_aporte numeric := 0;
begin
  if not (v_admin or public.tiene_rol('venta_local')) then raise exception 'Solo el rol Venta local registra ventas en el local'; end if;
  if p_tipo not in ('efectivo', 'transferencia', 'mixto') then raise exception 'Forma de pago inválida'; end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then raise exception 'La venta no tiene productos'; end if;
  v_ev := privado.comprobantes_validos(p_evidencias);
  if p_tipo in ('transferencia', 'mixto') and cardinality(v_ev) = 0 then raise exception 'Sube la foto del comprobante de la transferencia'; end if;
  if p_vendedora is not null then
    select nombre into v_vend_nombre from public.usuarios where id = p_vendedora and activo and 'vendedora' = any(roles);
    if v_vend_nombre is null then raise exception 'Esa vendedora no existe o está inactiva'; end if;
  end if;

  insert into public.pedidos (estado, canal, vendedora_id, cliente_nombre, cliente_telefono, observaciones, valor_domicilio)
  values ('entregado', 'local', p_vendedora, coalesce(nullif(trim(p_cliente_nombre), ''), 'Cliente del local'),
          nullif(trim(p_cliente_telefono), ''), nullif(trim(p_observaciones), ''), 0)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint and activo;
    if not found then raise exception 'Producto no disponible'; end if;
    v_cant := (it->>'cantidad')::int;
    if v_cant is null or v_cant < 1 then raise exception 'Cantidad inválida'; end if;
    v_precio := coalesce((it->>'precio_venta')::numeric, pr.precio_venta);
    if v_precio < pr.precio_base and not v_admin then
      raise exception 'El precio de % no puede ser menor al precio base (%)', pr.nombre, pr.precio_base;
    end if;
    insert into public.pedido_items (pedido_id, producto_id, nombre, cantidad, precio_venta, precio_base, precio_compra, total, color, talla)
    values (v_id, pr.id, pr.nombre, v_cant, v_precio, pr.precio_base, pr.precio_compra, v_precio * v_cant,
            nullif(left(trim(it->>'color'), 40), ''), nullif(left(trim(it->>'talla'), 40), ''));
    v_sub := v_sub + v_precio * v_cant;
    v_gan := v_gan + (v_precio - pr.precio_base) * v_cant;
  end loop;

  if p_tipo = 'efectivo' then p_efectivo := v_sub; p_transferencia := 0;
  elsif p_tipo = 'transferencia' then p_efectivo := 0; p_transferencia := v_sub;
  elsif coalesce(p_efectivo, 0) + coalesce(p_transferencia, 0) <> v_sub then raise exception 'Efectivo + transferencia debe sumar %', v_sub;
  end if;

  -- Aporte para mantener el punto físico: sale de la ganancia de la vendedora (nunca la deja negativa)
  if p_vendedora is not null then
    v_aporte := least(coalesce((select aporte_alcancia from public.configuracion order by id limit 1), 2000), greatest(v_gan, 0));
  end if;

  update public.pedidos set total = v_sub, entregado_at = now(), tipo_recaudo = p_tipo,
    valor_efectivo = p_efectivo, valor_transferencia = p_transferencia, stock_descontado = true,
    aporte_alcancia = v_aporte, evidencias = case when cardinality(v_ev) > 0 then v_ev end
  where id = v_id;
  update public.productos x set stock = x.stock - i.cantidad, updated_at = now()
    from public.pedido_items i where i.pedido_id = v_id and i.producto_id = x.id and x.controla_stock;

  insert into public.pedido_notas (pedido_id, autor, nota) values (v_id, v_yo_nombre,
    'Venta en el local · ' || p_tipo || coalesce(' · vendedora: ' || v_vend_nombre, ' · sin vendedora')
    || case when v_aporte > 0 then ' · alcancía $' || replace(to_char(v_aporte, 'FM999G999G999'), ',', '.') else '' end);

  if p_vendedora is not null then
    perform privado.avisar(array[p_vendedora], 'venta_local',
      'Venta en el local #' || v_id || ' a tu nombre',
      coalesce(nullif(trim(p_cliente_nombre), ''), 'Cliente del local') || ' · ' || '$' || replace(to_char(v_sub, 'FM999G999G999'), ',', '.')
      || ' · tu ganancia ' || '$' || replace(to_char(v_gan - v_aporte, 'FM999G999G999'), ',', '.')
      || case when v_aporte > 0 then ' (ya con $' || replace(to_char(v_aporte, 'FM999G999G999'), ',', '.') || ' para la alcancía)' else '' end,
      '/app/pedidos?id=' || v_id, v_id);
  end if;
  return v_id;
end $fn$;
create or replace function public.registrar_venta_local(
  p_cliente_nombre text, p_cliente_telefono text, p_observaciones text, p_items jsonb,
  p_tipo text, p_efectivo numeric, p_transferencia numeric, p_vendedora bigint default null)
returns bigint language sql security definer set search_path = '' as $fn$
  select public.registrar_venta_local(p_cliente_nombre, p_cliente_telefono, p_observaciones, p_items, p_tipo, p_efectivo, p_transferencia, p_vendedora, null::text[])
$fn$;
revoke all on function public.registrar_venta_local(text, text, text, jsonb, text, numeric, numeric, bigint, text[]) from public, anon;
grant execute on function public.registrar_venta_local(text, text, text, jsonb, text, numeric, numeric, bigint, text[]) to authenticated;

-- ---------- Editar una venta del local recalcula el aporte (solo las de ahora en adelante) ----------
do $$
declare s text := pg_get_functiondef('public.editar_pedido(bigint,text,text,text,text,text,numeric,jsonb)'::regprocedure);
begin
  if position('aporte_alcancia' in s) = 0 then
    if position('valor_domicilio = v_dom, total = v_sub + v_dom, updated_at = now(),' in s) = 0 then raise exception 'editar_pedido cambió'; end if;
    s := replace(s, 'valor_domicilio = v_dom, total = v_sub + v_dom, updated_at = now(),',
      'valor_domicilio = v_dom, total = v_sub + v_dom, updated_at = now(),
    aporte_alcancia = case when p.canal = ''local'' and p.vendedora_id is not null and p.created_at >= ''2026-10-17 00:00 America/Bogota''::timestamptz
      then least(coalesce((select c.aporte_alcancia from public.configuracion c order by c.id limit 1), 2000),
                 greatest(0, (select coalesce(sum((x.precio_venta - x.precio_base) * x.cantidad), 0) from public.pedido_items x where x.pedido_id = p.id)))
      else p.aporte_alcancia end,');
    execute s;
  end if;
end $$;

-- ---------- La ganancia de la vendedora ya sin el aporte ----------
create or replace view public.ventas_pedidos with (security_invoker = true) as
 SELECT p.id, p.created_at, p.entregado_at, p.estado, p.cliente_nombre, p.cliente_telefono, p.barrio,
    v.nombre AS vendedora, m.nombre AS mensajero, p.vendedora_id, p.mensajero_id,
    COALESCE(s.productos, ''::text) AS productos, COALESCE(s.unidades, (0)::bigint) AS unidades,
    COALESCE(s.subtotal, (0)::numeric) AS subtotal, p.valor_domicilio AS domicilio, p.total,
    COALESCE(s.costo, (0)::numeric) AS costo, COALESCE(s.ganancia_tienda, (0)::numeric) AS ganancia_tienda,
    COALESCE(s.ganancia_vendedora, (0)::numeric) - p.aporte_alcancia AS ganancia_vendedora,
    p.tipo_recaudo, p.valor_efectivo, p.valor_transferencia, p.aporte_alcancia
   FROM pedidos p
     LEFT JOIN usuarios v ON v.id = p.vendedora_id
     LEFT JOIN usuarios m ON m.id = p.mensajero_id
     LEFT JOIN LATERAL ( SELECT string_agg(i.nombre || CASE WHEN i.cantidad > 1 THEN ' x'::text || i.cantidad ELSE ''::text END, ', '::text ORDER BY i.id) AS productos,
            sum(i.cantidad) AS unidades, sum(i.total) AS subtotal, sum(i.precio_compra * i.cantidad::numeric) AS costo,
            sum((i.precio_base - i.precio_compra) * i.cantidad::numeric) AS ganancia_tienda,
            sum((i.precio_venta - i.precio_base) * i.cantidad::numeric) AS ganancia_vendedora
           FROM pedido_items i WHERE i.pedido_id = p.id) s ON true;

-- Por línea: el aporte se descuenta en la primera línea del pedido (así las sumas cuadran)
create or replace view public.ventas_detalle with (security_invoker = true) as
 SELECT i.id, p.id AS pedido_id, p.created_at, p.entregado_at, p.estado, p.cliente_nombre, p.cliente_telefono, p.barrio,
    v.nombre AS vendedora, m.nombre AS mensajero, p.vendedora_id, p.mensajero_id, i.producto_id, i.nombre AS producto, pr.sku,
    i.cantidad, i.precio_venta, i.precio_base, i.precio_compra, i.total,
    i.precio_compra * i.cantidad::numeric AS costo,
    (i.precio_base - i.precio_compra) * i.cantidad::numeric AS ganancia_tienda,
    (i.precio_venta - i.precio_base) * i.cantidad::numeric
      - CASE WHEN p.aporte_alcancia > 0 AND i.id = (SELECT min(x.id) FROM pedido_items x WHERE x.pedido_id = p.id) THEN p.aporte_alcancia ELSE 0 END AS ganancia_vendedora,
    p.valor_domicilio AS domicilio_pedido, p.tipo_recaudo, i.color, i.talla
   FROM pedido_items i
     JOIN pedidos p ON p.id = i.pedido_id
     LEFT JOIN productos pr ON pr.id = i.producto_id
     LEFT JOIN usuarios v ON v.id = p.vendedora_id
     LEFT JOIN usuarios m ON m.id = p.mensajero_id;

do $$
declare f text; s text; a text; b text; pares text[][] := array[
  ['public.reporte_filtrado(date,date,text,bigint)', '''ganancia_vendedora'', s.ventas - s.base,',
   '''ganancia_vendedora'', s.ventas - s.base - coalesce((select sum(e.aporte_alcancia) from ent e where e.vendedora_id is not distinct from s.vendedora_id), 0),'],
  ['public.reporte_filtrado(date,date,text,bigint)', 'coalesce(sum(g.ventas - g.base), 0) gv', 'coalesce(sum(g.ventas - g.base), 0) - coalesce(sum(e.aporte_alcancia), 0) gv'],
  ['public.reporte_totales_filtrado(date,date,text,bigint)', '''ganancia_vendedoras'', (select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it),',
   '''ganancia_vendedoras'', (select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it) - (select coalesce(sum(aporte_alcancia),0) from ent),
    ''alcancia'', (select coalesce(sum(aporte_alcancia),0) from ent),'],
  ['public.resumen(date,date)', '''margen_vendedoras'', (select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it),',
   '''margen_vendedoras'', (select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it) - (select coalesce(sum(aporte_alcancia),0) from ent),
    ''alcancia'', (select coalesce(sum(aporte_alcancia),0) from ent),'],
  ['public.mi_reporte(date,date)', '''ganancia'', (select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it),',
   '''ganancia'', (select coalesce(sum((precio_venta - precio_base) * cantidad),0) from it) - (select coalesce(sum(aporte_alcancia),0) from ent),']
];
  i int;
begin
  for i in 1 .. array_length(pares, 1) loop
    f := pares[i][1]; a := pares[i][2]; b := pares[i][3];
    s := pg_get_functiondef(f::regprocedure);
    if position('aporte_alcancia' in s) > 0 and position(b in s) > 0 then continue; end if;
    if position(a in s) = 0 then raise exception 'No se encontró el texto en %: %', f, left(a, 60); end if;
    execute replace(s, a, b);
  end loop;
end $$;

-- Mi panel: ganancia ya sin el aporte, y cuánto aportó
create or replace function public.mi_panel(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_yo bigint := public.mi_usuario_id();
  r jsonb;
begin
  if v_yo is null or not (public.tiene_rol('vendedora') or public.tiene_rol('admin')) then raise exception 'Sin permiso'; end if;
  if p_hasta < p_desde or p_hasta - p_desde > 400 then raise exception 'Rango de fechas inválido (máximo 400 días)'; end if;
  with mios as (
    select * from public.pedidos where vendedora_id = v_yo and created_at >= d and created_at < h
  ), it as (
    select i.*, m.estado, m.created_at as pedido_at from public.pedido_items i join mios m on m.id = i.pedido_id
  ), dias as (
    select g::date as dia from generate_series(p_desde, p_hasta, interval '1 day') g
  ), por_dia as (
    select dia, sum(g) g from (
      select (pedido_at at time zone 'America/Bogota')::date as dia, (precio_venta - precio_base) * cantidad as g from it where estado = 'entregado'
      union all
      select (created_at at time zone 'America/Bogota')::date, -aporte_alcancia from mios where estado = 'entregado' and aporte_alcancia > 0
    ) z group by dia
  )
  select jsonb_build_object(
    'ganancia', (select coalesce(sum((precio_venta - precio_base) * cantidad), 0) from it where estado = 'entregado')
                - (select coalesce(sum(aporte_alcancia), 0) from mios where estado = 'entregado'),
    'alcancia', (select coalesce(sum(aporte_alcancia), 0) from mios where estado = 'entregado'),
    'ventas', (select coalesce(sum(total), 0) from it where estado = 'entregado'),
    'entregados', (select count(*) from mios where estado = 'entregado'),
    'unidades', (select coalesce(sum(cantidad), 0) from it where estado = 'entregado'),
    'en_curso', (select count(*) from mios where estado in ('por_alistar', 'alistado', 'despachado')),
    'ganancia_en_curso', (select coalesce(sum((precio_venta - precio_base) * cantidad), 0) from it where estado in ('por_alistar', 'alistado', 'despachado')),
    'cancelados', (select count(*) from mios where estado = 'cancelado'),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', dias.dia, 'ganancia', coalesce(x.g, 0)) order by dias.dia), '[]')
                from dias left join por_dia x on x.dia = dias.dia)
  ) into r;
  return r;
end $fn$;

-- ---------- Alcancía ----------
create or replace function public.alcancia(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
begin
  if not (public.tiene_rol('admin') or public.tiene_rol('venta_local') or public.tiene_rol('cuadres')) then raise exception 'Sin permiso'; end if;
  if p_hasta < p_desde or p_hasta - p_desde > 400 then raise exception 'Rango de fechas inválido (máximo 400 días)'; end if;
  return jsonb_build_object(
    'saldo', (select coalesce(sum(aporte_alcancia), 0) from public.pedidos where estado = 'entregado' and aporte_alcancia > 0)
             - (select coalesce(sum(monto), 0) from public.alcancia_retiros),
    'aporte', (select coalesce(aporte_alcancia, 2000) from public.configuracion order by id limit 1),
    'entradas', (select coalesce(sum(aporte_alcancia), 0) from public.pedidos where estado = 'entregado' and aporte_alcancia > 0 and created_at >= d and created_at < h),
    'ventas', (select count(*) from public.pedidos where estado = 'entregado' and aporte_alcancia > 0 and created_at >= d and created_at < h),
    'salidas', (select coalesce(sum(monto), 0) from public.alcancia_retiros where created_at >= d and created_at < h),
    'por_vendedora', (select coalesce(jsonb_agg(jsonb_build_object('nombre', coalesce(u.nombre, '—'), 'avatar_url', u.avatar_url, 'ventas', s.n, 'total', s.t) order by s.t desc), '[]') from (
        select vendedora_id, count(*) n, sum(aporte_alcancia) t from public.pedidos
        where estado = 'entregado' and aporte_alcancia > 0 and created_at >= d and created_at < h group by 1) s
        left join public.usuarios u on u.id = s.vendedora_id),
    'movimientos', (select coalesce(jsonb_agg(m order by m.fecha desc), '[]') from (
        select * from (
          select 'entrada' tipo, p.created_at fecha, p.aporte_alcancia monto, p.id pedido_id, u.nombre vendedora, null::text concepto, null::text quien
          from public.pedidos p left join public.usuarios u on u.id = p.vendedora_id
          where p.estado = 'entregado' and p.aporte_alcancia > 0 and p.created_at >= d and p.created_at < h
          union all
          select 'salida', r.created_at, r.monto, null, null, r.concepto, r.usuario_nombre
          from public.alcancia_retiros r where r.created_at >= d and r.created_at < h
        ) z order by fecha desc limit 400) m)
  );
end $fn$;

-- Retiro (gasto del punto físico): solo admin, y no más de lo que hay
create or replace function public.alcancia_retirar(p_monto numeric, p_concepto text)
returns bigint language plpgsql security definer set search_path = '' as $fn$
declare v_id bigint; v_saldo numeric;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin registra retiros de la alcancía'; end if;
  if coalesce(p_monto, 0) <= 0 then raise exception 'Escribe el valor del retiro'; end if;
  if coalesce(trim(p_concepto), '') = '' then raise exception 'Escribe en qué se usó la plata'; end if;
  perform pg_advisory_xact_lock(hashtext('alcancia'));
  v_saldo := (select coalesce(sum(aporte_alcancia), 0) from public.pedidos where estado = 'entregado' and aporte_alcancia > 0)
             - (select coalesce(sum(monto), 0) from public.alcancia_retiros);
  if p_monto > v_saldo then raise exception 'En la alcancía solo hay $%', replace(to_char(v_saldo, 'FM999G999G999'), ',', '.'); end if;
  insert into public.alcancia_retiros (monto, concepto, usuario_id, usuario_nombre)
  values (p_monto, left(trim(p_concepto), 200), public.mi_usuario_id(), public.mi_nombre()) returning id into v_id;
  return v_id;
end $fn$;

revoke all on function public.alcancia(date, date) from public, anon;
revoke all on function public.alcancia_retirar(numeric, text) from public, anon;
grant execute on function public.alcancia(date, date) to authenticated;
grant execute on function public.alcancia_retirar(numeric, text) to authenticated;
