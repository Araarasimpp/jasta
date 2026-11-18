-- YA APLICADO (2026-11-17). Queda aquí como registro.
-- Funciones con IA (Gemini): comprobantes leídos, transcripción de notas de voz y el contexto
-- de datos para "Pregúntale a Jasta".

-- 1. Comprobantes de transferencia leídos por la IA (para detectar repetidos)
create table if not exists public.comprobantes_leidos (
  ruta text primary key,
  pedido_id bigint references public.pedidos(id) on delete cascade,
  valor numeric,
  banco text,
  fecha text,
  referencia text,
  datos jsonb not null default '{}',
  leido_at timestamptz not null default now()
);
alter table public.comprobantes_leidos enable row level security;
create index if not exists comprobantes_leidos_ref on public.comprobantes_leidos (referencia) where referencia is not null;

create or replace function public.registrar_comprobante(p_ruta text, p_pedido bigint, p_datos jsonb)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_ref text := nullif(regexp_replace(coalesce(p_datos->>'referencia', ''), '\s', '', 'g'), '');
  v_valor numeric := nullif(regexp_replace(coalesce(p_datos->>'valor', ''), '[^0-9.]', '', 'g'), '')::numeric;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  insert into public.comprobantes_leidos (ruta, pedido_id, valor, banco, fecha, referencia, datos)
  values (p_ruta, p_pedido, v_valor, p_datos->>'banco', p_datos->>'fecha', v_ref, coalesce(p_datos, '{}'))
  on conflict (ruta) do update set pedido_id = excluded.pedido_id, valor = excluded.valor, banco = excluded.banco,
    fecha = excluded.fecha, referencia = excluded.referencia, datos = excluded.datos, leido_at = now();
  -- El mismo comprobante (misma referencia) usado en otro pedido
  return jsonb_build_object('repetidos', (select coalesce(jsonb_agg(distinct c.pedido_id), '[]') from public.comprobantes_leidos c
    where c.ruta <> p_ruta and c.pedido_id is distinct from p_pedido and v_ref is not null and length(v_ref) >= 4 and c.referencia = v_ref));
end $function$;

create or replace function public.comprobantes_leidos_de(p_rutas text[])
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_object_agg(c.ruta, c.datos || jsonb_build_object('repetidos', (select coalesce(jsonb_agg(distinct o.pedido_id), '[]')
      from public.comprobantes_leidos o where o.ruta <> c.ruta and o.pedido_id is distinct from c.pedido_id and c.referencia is not null
        and length(c.referencia) >= 4 and o.referencia = c.referencia))), '{}')
    from public.comprobantes_leidos c where c.ruta = any(p_rutas));
end $function$;

-- 4. Notas de voz: lo que dijo, guardado para no volver a transcribir
alter table public.pedido_mensajes add column if not exists transcripcion text;
create or replace function public.guardar_transcripcion(p_mensaje bigint, p_texto text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare v_ped bigint;
begin
  select pedido_id into v_ped from public.pedido_mensajes where id = p_mensaje and tipo = 'audio';
  if v_ped is null or not public.participa_en_pedido(v_ped) then raise exception 'Sin permiso'; end if;
  update public.pedido_mensajes set transcripcion = left(trim(p_texto), 4000) where id = p_mensaje;
end $function$;

-- 9. Los datos del negocio que la IA usa para responder preguntas (solo admin, desde la función ia)
create or replace function privado.contexto_ia()
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_mes date := date_trunc('month', v_hoy)::date;
  v_ant date := (v_mes - interval '1 month')::date;
  v_sab date := v_hoy - ((extract(dow from v_hoy)::int + 1) % 7);
  d timestamptz := (v_mes::text || ' 00:00 America/Bogota')::timestamptz;
  da timestamptz := (v_ant::text || ' 00:00 America/Bogota')::timestamptz;
begin
  return jsonb_build_object(
    'hoy', v_hoy,
    'nota', 'Ventas sin domicilios de pedidos entregados, por el día en que se subió el pedido. Montos en pesos colombianos. Para comparar el mes en curso con el pasado usa mes_pasado_mismos_dias (mismos días), no el mes pasado completo.',
    'hoy_cifras', privado.cifras_periodo(v_hoy, v_hoy),
    'semana_pago_sab_a_hoy', privado.cifras_periodo(v_sab, v_hoy),
    'este_mes', privado.cifras_periodo(v_mes, v_hoy),
    'mes_pasado', privado.cifras_periodo(v_ant, v_mes - 1),
    'mes_pasado_mismos_dias', privado.cifras_periodo(v_ant, least(v_ant + (v_hoy - v_mes), v_mes - 1)),
    'ultimos_6_meses', (select jsonb_agg(jsonb_build_object('mes', to_char(m, 'YYYY-MM'), 'cifras', privado.cifras_periodo(m::date, least((m + interval '1 month - 1 day')::date, v_hoy))) order by m)
      from generate_series(v_mes - interval '5 months', v_mes, interval '1 month') m),
    'vendedoras_este_mes', (select jsonb_agg(x order by (x->>'ventas')::numeric desc) from (select jsonb_build_object('nombre', v.vendedora, 'pedidos', count(*), 'ventas', sum(v.subtotal), 'comision', sum(v.ganancia_vendedora)) x
      from public.ventas_pedidos v where v.estado = 'entregado' and v.created_at >= d and v.vendedora is not null group by v.vendedora) s),
    'vendedoras_mes_pasado', (select jsonb_agg(x) from (select jsonb_build_object('nombre', v.vendedora, 'pedidos', count(*), 'ventas', sum(v.subtotal), 'comision', sum(v.ganancia_vendedora)) x
      from public.ventas_pedidos v where v.estado = 'entregado' and v.created_at >= da and v.created_at < d and v.vendedora is not null group by v.vendedora) s),
    'mensajeros_este_mes', (select jsonb_agg(jsonb_build_object('nombre', s.mensajero, 'entregas', s.n)) from (select v.mensajero, count(*) n
      from public.ventas_pedidos v where v.estado = 'entregado' and v.created_at >= d and v.mensajero is not null group by 1 order by 2 desc) s),
    'productos_mas_vendidos_este_mes', (select jsonb_agg(jsonb_build_object('producto', s.producto, 'unidades', s.u, 'ventas', s.t, 'ganancia_tienda', s.g)) from (
      select x.producto, sum(x.cantidad) u, sum(x.total) t, sum(x.ganancia_tienda) g from public.ventas_detalle x
      where x.estado = 'entregado' and x.created_at >= d group by 1 order by 2 desc limit 20) s),
    'productos_mas_ganancia_este_mes', (select jsonb_agg(jsonb_build_object('producto', s.producto, 'ganancia_tienda', s.g, 'unidades', s.u)) from (
      select x.producto, sum(x.ganancia_tienda) g, sum(x.cantidad) u from public.ventas_detalle x
      where x.estado = 'entregado' and x.created_at >= d group by 1 order by 2 desc limit 15) s),
    'stock_bajo', (select jsonb_agg(jsonb_build_object('producto', p.nombre, 'stock', p.stock, 'minimo', p.stock_minimo)) from (
      select nombre, stock, stock_minimo from public.productos where activo and controla_stock and (stock <= 0 or stock <= coalesce(stock_minimo, 0)) order by stock limit 30) p),
    'gastos_este_mes_por_categoria', (select jsonb_object_agg(g.categoria, g.t) from (select categoria, sum(valor) t from public.gastos where fecha >= v_mes group by 1) g),
    'comisiones_semana', privado.comisiones_semana(v_hoy),
    'ahorro', privado.ahorro_estado() - 'retiros',
    'clientes_top_este_mes', (select jsonb_agg(jsonb_build_object('cliente', s.c, 'pedidos', s.n, 'total', s.t)) from (
      select v.cliente_nombre c, count(*) n, sum(v.total) t from public.ventas_pedidos v where v.estado = 'entregado' and v.created_at >= d group by 1 order by 3 desc limit 10) s),
    'pedidos_activos', (select jsonb_object_agg(estado, n) from (select estado::text, count(*) n from public.pedidos where estado in ('por_alistar', 'alistado', 'despachado') group by 1) s)
  );
end $function$;

grant execute on function public.registrar_comprobante(text, bigint, jsonb), public.comprobantes_leidos_de(text[]), public.guardar_transcripcion(bigint, text) to authenticated;
