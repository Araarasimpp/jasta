-- Automatizaciones (YA APLICADO)
--  1. Pedidos de la tienda sin confirmar: recordatorio a la vendedora a los 15 min y aviso al admin a la hora
--  2. Cierre de caja del local: sección en el cierre del día (Telegram) y aviso push a admin y venta local
--  3. Lista de compras sugerida: qué pedir al proveedor según lo vendido; llega los lunes
--  4. Metas: avance propio (mi_meta) y avisos al llegar al 50 %, 80 % y 100 %
--  5. Garantía: el seguimiento dice si fue compra en el local y trae el texto de garantía (QR del ticket)

-- ================================================================ 1. Pedidos de la tienda sin confirmar
alter table public.pedidos_web add column if not exists recordado_at timestamptz,
  add column if not exists escalado_at timestamptz;

create or replace function privado.revisar_pedidos_web()
returns void language plpgsql security definer set search_path to '' as $function$
declare
  w record;
  v_hora int := extract(hour from now() at time zone 'America/Bogota');
begin
  -- De noche no se molesta a nadie: lo pendiente se avisa a las 7 a. m.
  if v_hora < 7 or v_hora >= 21 then return; end if;

  for w in select pw.* from public.pedidos_web pw
           where pw.estado = 'por_confirmar' and pw.recordado_at is null and pw.created_at < now() - interval '15 minutes'
           for update skip locked loop
    perform privado.avisar(case when w.vendedora_id is null then privado.con_rol(array['admin']) else array[w.vendedora_id] end,
      'pedido_web', '⏰ ' || split_part(w.cliente_nombre, ' ', 1) || ' está esperando tu llamada',
      'Pedido de la tienda sin confirmar desde las ' || lower(to_char(w.created_at at time zone 'America/Bogota', 'FMHH12:MI AM'))
        || ' · ' || privado.pesos(w.subtotal + w.valor_domicilio) || '. Llámalo antes de que se enfríe.',
      '/app/pedidos-web', null);
    update public.pedidos_web set recordado_at = now() where id = w.id;
  end loop;

  -- Si a los 45 min del recordatorio sigue igual, se le avisa al admin (si era de una vendedora)
  for w in select pw.*, u.nombre vendedora from public.pedidos_web pw left join public.usuarios u on u.id = pw.vendedora_id
           where pw.estado = 'por_confirmar' and pw.escalado_at is null and pw.recordado_at < now() - interval '45 minutes'
           for update of pw skip locked loop
    if w.vendedora_id is not null then
      perform privado.avisar(privado.con_rol(array['admin']), 'pedido_web',
        'Pedido de la tienda lleva más de 1 hora sin confirmar',
        split_part(w.cliente_nombre, ' ', 1) || ' · ' || privado.pesos(w.subtotal + w.valor_domicilio) || ' · catálogo de ' || split_part(w.vendedora, ' ', 1),
        '/app/pedidos-web', null);
    end if;
    update public.pedidos_web set escalado_at = now() where id = w.id;
  end loop;
end $function$;

-- Los que ya llevan más de un día esperando no se avisan de golpe
update public.pedidos_web set recordado_at = now(), escalado_at = now()
where estado = 'por_confirmar' and created_at < now() - interval '1 day' and recordado_at is null;

select cron.schedule('pedidos-web-sin-confirmar', '*/5 * * * *', 'select privado.revisar_pedidos_web()');

-- ================================================================ 2. Cierre de caja del local
create or replace function privado.cierre_local(p_dia date)
returns jsonb language sql stable security definer set search_path to '' as $$
  with v as (
    select p.* from public.pedidos p
    where p.canal = 'local' and p.estado = 'entregado'
      and p.created_at >= (p_dia::text || ' 00:00 America/Bogota')::timestamptz
      and p.created_at < ((p_dia + 1)::text || ' 00:00 America/Bogota')::timestamptz
  )
  select jsonb_build_object(
    'ventas', (select count(*) from v),
    'total', (select coalesce(sum(total), 0) from v),
    'efectivo', (select coalesce(sum(valor_efectivo), 0) from v),
    'transferencia', (select coalesce(sum(valor_transferencia), 0) from v),
    'alcancia', (select coalesce(sum(aporte_alcancia), 0) from v),
    'por_vendedora', (select string_agg(nombre || ' ' || n || ' (' || privado.pesos(t) || ')', ' · ' order by t desc) from (
        select coalesce(split_part(u.nombre, ' ', 1), 'Tienda') nombre, count(*) n, sum(v.total) t
        from v left join public.usuarios u on u.id = v.vendedora_id group by 1) s))
$$;

create or replace function privado.cierre_dia_texto(p_dia date)
returns text language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_dia::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_dia + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  v_ent int; v_ventas numeric; v_gan numeric; v_gastos numeric; v_nuevos int; v_canc int; v_nov int; v_nov_abiertas int;
  v_por_alistar int; v_alistados int; v_ruta int; v_cuadres numeric; v_cuadres_m int; v_comis numeric; v_top text;
  l jsonb := privado.cierre_local(p_dia);
begin
  select count(*), coalesce(sum(total - valor_domicilio), 0) into v_ent, v_ventas from public.pedidos where estado = 'entregado' and entregado_at >= d and entregado_at < h;
  select coalesce(sum((i.precio_base - i.precio_compra) * i.cantidad), 0) into v_gan
    from public.pedidos p join public.pedido_items i on i.pedido_id = p.id where p.estado = 'entregado' and p.created_at >= d and p.created_at < h;
  select coalesce(sum(valor), 0) into v_gastos from public.gastos where fecha = p_dia;
  select count(*) filter (where estado <> 'cancelado'), count(*) filter (where estado = 'cancelado') into v_nuevos, v_canc
    from public.pedidos where created_at >= d and created_at < h;
  select count(*) into v_nov from public.pedido_novedades where created_at >= d and created_at < h;
  select count(*) into v_nov_abiertas from public.pedidos where novedades > 0 and estado not in ('entregado', 'cancelado');
  select count(*) filter (where estado = 'por_alistar'), count(*) filter (where estado = 'alistado'), count(*) filter (where estado = 'despachado')
    into v_por_alistar, v_alistados, v_ruta from public.pedidos where estado in ('por_alistar', 'alistado', 'despachado');
  select coalesce(sum(coalesce(valor_efectivo, 0) - coalesce(valor_domicilio, 0)), 0), count(distinct mensajero_id) into v_cuadres, v_cuadres_m
    from public.pedidos where estado = 'entregado' and cuadre_id is null;
  select coalesce(sum(comision), 0) into v_comis from (select comision from privado.por_liquidar(null) union all select comision from privado.descuentos_por_liquidar(null)) z;
  select u.nombre || ' (' || s.n || ')' into v_top from (
    select vendedora_id, count(*) n from public.pedidos where estado <> 'cancelado' and created_at >= d and created_at < h and vendedora_id is not null
    group by 1 order by 2 desc limit 1) s join public.usuarios u on u.id = s.vendedora_id;

  return '📊 Cierre del día · ' || to_char(p_dia, 'DD/MM/YYYY') || E'\n\n'
    || '✅ Entregados: ' || v_ent || ' · ' || privado.pesos(v_ventas) || E'\n'
    || '💰 Ganancia tienda: ' || privado.pesos(v_gan) || E'\n'
    || '🧾 Gastos: ' || privado.pesos(v_gastos) || E'\n'
    || '📈 Utilidad del día: ' || privado.pesos(v_gan - v_gastos) || E'\n\n'
    || '🆕 Pedidos nuevos: ' || v_nuevos || case when v_canc > 0 then ' · ❌ cancelados: ' || v_canc else '' end || E'\n'
    || coalesce('🏆 Más vendió: ' || v_top || E'\n', '')
    || '⚠️ Novedades hoy: ' || v_nov || case when v_nov_abiertas > 0 then ' · sin resolver: ' || v_nov_abiertas else '' end || E'\n\n'
    || '📦 Por alistar: ' || v_por_alistar || ' · Alistados: ' || v_alistados || ' · En ruta: ' || v_ruta || E'\n'
    || '💵 Por recibir en cuadres: ' || privado.pesos(v_cuadres) || case when v_cuadres_m > 0 then ' (' || v_cuadres_m || case when v_cuadres_m = 1 then ' mensajero)' else ' mensajeros)' end else '' end || E'\n'
    || '👛 Comisiones por pagar: ' || privado.pesos(v_comis)
    || case when (l->>'ventas')::int > 0 then E'\n\n'
      || '🏪 Caja del local: ' || (l->>'ventas') || case when (l->>'ventas')::int = 1 then ' venta · ' else ' ventas · ' end || privado.pesos((l->>'total')::numeric) || E'\n'
      || '   💵 Efectivo que debe haber en caja: ' || privado.pesos((l->>'efectivo')::numeric) || E'\n'
      || '   📲 Transferencias: ' || privado.pesos((l->>'transferencia')::numeric) || E'\n'
      || case when (l->>'alcancia')::numeric > 0 then '   🐷 Para la alcancía: ' || privado.pesos((l->>'alcancia')::numeric) || E'\n' else '' end
      || coalesce('   👤 ' || (l->>'por_vendedora'), '')
    else '' end;
end $function$;

create or replace function privado.enviar_cierre_dia(p_dia date default null)
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_token text; v_texto text; r record; n int := 0; v_dia date := coalesce(p_dia, (now() at time zone 'America/Bogota')::date);
  l jsonb := privado.cierre_local(v_dia);
begin
  -- Aviso en la app del cierre de caja del local (aunque no haya Telegram)
  if (l->>'ventas')::int > 0 then
    perform privado.avisar(privado.con_rol(array['admin', 'venta_local']), 'cierre_local',
      'Cierre del local · ' || (l->>'ventas') || case when (l->>'ventas')::int = 1 then ' venta · ' else ' ventas · ' end || privado.pesos((l->>'total')::numeric),
      'Efectivo que debe haber en caja: ' || privado.pesos((l->>'efectivo')::numeric) || ' · Transferencias: ' || privado.pesos((l->>'transferencia')::numeric),
      '/app/ventas-local', null);
  end if;

  select token into v_token from privado.telegram_config limit 1;
  if v_token is null then return 0; end if;
  v_texto := privado.cierre_dia_texto(v_dia);
  for r in select distinct t.telegram_id from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id
           where u.activo and 'admin' = any (u.roles) loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
                          body := jsonb_build_object('chat_id', r.telegram_id, 'text', v_texto),
                          headers := '{"Content-Type": "application/json"}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $function$;

-- ================================================================ 3. Lista de compras sugerida
-- Ritmo de venta = unidades de los últimos 60 días (no cancelados) / 60. Se sugiere tener para
-- p_dias días (por defecto 3 semanas), nunca menos que el stock mínimo.
create or replace function privado.compras_sugeridas(p_dias int default 21)
returns table(id bigint, nombre text, categoria text, stock int, vendidos_60 int, dias int, sugerido int, costo numeric)
language sql stable security definer set search_path to '' as $$
  with v as (
    select i.producto_id, sum(i.cantidad)::int n from public.pedido_items i join public.pedidos p on p.id = i.pedido_id
    where p.estado <> 'cancelado' and p.created_at > now() - interval '60 days' group by 1
  ), s as (
    select p.id, p.nombre, p.categoria, p.stock, coalesce(v.n, 0) n, p.stock_minimo, p.precio_compra,
      greatest(ceil(coalesce(v.n, 0) / 60.0 * greatest(p_dias, 1))::int, p.stock_minimo) objetivo
    from public.productos p join v on v.producto_id = p.id
    where p.activo and p.controla_stock
  )
  select id, nombre, categoria, stock, n,
    case when n > 0 then floor(greatest(stock, 0) / (n / 60.0))::int end,
    objetivo - greatest(stock, 0), precio_compra
  from s
  where objetivo - greatest(stock, 0) > 0
  order by greatest(stock, 0) / greatest(n / 60.0, 0.0001), n desc
$$;

create or replace function public.compras_sugeridas(p_dias int default 21)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_admin boolean := public.tiene_rol('admin');
begin
  if not privado.puede_inventario() then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nombre', c.nombre, 'categoria', c.categoria, 'stock', c.stock,
      'vendidos_60', c.vendidos_60, 'dias', c.dias, 'sugerido', c.sugerido, 'costo', case when v_admin then c.costo end))
    from privado.compras_sugeridas(least(greatest(coalesce(p_dias, 21), 7), 90)) c), '[]');
end $function$;
revoke execute on function public.compras_sugeridas(int) from public, anon;
grant execute on function public.compras_sugeridas(int) to authenticated;
revoke execute on function privado.compras_sugeridas(int) from public, anon, authenticated;

create or replace function privado.enviar_lista_compras()
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_token text; v_texto text; v_n int; v_total numeric; v_top text; r record; n int := 0;
begin
  select count(*), coalesce(sum(sugerido * coalesce(costo, 0)), 0) into v_n, v_total from privado.compras_sugeridas(21);
  if v_n = 0 then return 0; end if;
  select string_agg(nombre, ', ') into v_top from (select nombre from privado.compras_sugeridas(21) limit 3) t;

  perform privado.avisar(privado.con_rol(array['admin', 'alistador']), 'compras',
    'Lista de compras de la semana: ' || v_n || case when v_n = 1 then ' producto' else ' productos' end || ' por pedir',
    'Lo más urgente: ' || v_top, '/app/inventario?ver=comprar', null);

  select token into v_token from privado.telegram_config limit 1;
  if v_token is null then return 0; end if;
  select '🛒 Lista de compras · ' || to_char((now() at time zone 'America/Bogota')::date, 'DD/MM/YYYY') || E'\n'
      || 'Para tener inventario de 3 semanas según lo que se vende:' || E'\n\n'
      || string_agg('• ' || nombre || ' — pedir ' || sugerido || ' (quedan ' || greatest(stock, 0)
           || case when dias is not null then ', ~' || dias || ' días' else '' end || ')', E'\n')
      || case when v_n > 40 then E'\n… y ' || (v_n - 40) || ' más en Inventario → Qué comprar' else '' end
      || E'\n\n💰 Costo aproximado: ' || privado.pesos(v_total)
    into v_texto
  from (select * from privado.compras_sugeridas(21) limit 40) c;
  for r in select distinct t.telegram_id from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id
           where u.activo and 'admin' = any (u.roles) loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
                          body := jsonb_build_object('chat_id', r.telegram_id, 'text', v_texto),
                          headers := '{"Content-Type": "application/json"}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $function$;

-- Lunes 7:40 a. m. en Colombia (12:40 UTC)
select cron.schedule('lista-compras', '40 12 * * 1', 'select privado.enviar_lista_compras()');

-- ================================================================ 4. Metas
-- Lo mismo que cuenta el ranking: vendedora = pedidos entregados suyos; mensajero = domicilios entregados
create or replace function privado.avance_metas(p_desde date, p_hasta date, p_semana boolean)
returns table(usuario_id bigint, tipo text, cantidad int, meta int)
language sql stable security definer set search_path to '' as $$
  with ent as (
    select * from public.pedidos
    where estado = 'entregado'
      and coalesce(entregado_at, created_at) >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz
      and coalesce(entregado_at, created_at) < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz
  )
  select u.id, 'vendedora', (select count(*)::int from ent where ent.vendedora_id = u.id),
    case when p_semana then mt.meta_ventas_semana else mt.meta_ventas end
  from public.usuarios u join public.metas mt on mt.usuario_id = u.id
  where u.activo and 'vendedora' = any (u.roles)
  union all
  select u.id, 'mensajero', (select count(*)::int from ent where ent.mensajero_id = u.id and ent.canal = 'domicilio'),
    case when p_semana then mt.meta_entregas_semana else mt.meta_entregas end
  from public.usuarios u join public.metas mt on mt.usuario_id = u.id
  where u.activo and 'mensajero' = any (u.roles)
$$;

-- Avance propio (para la tarjeta del panel)
create or replace function public.mi_meta()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_mes date := date_trunc('month', v_hoy)::date;
  v_sem date := date_trunc('week', v_hoy)::date;
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'hoy', v_hoy,
    'fin_mes', (v_mes + interval '1 month - 1 day')::date,
    'mes', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'cantidad', cantidad, 'meta', meta)), '[]')
            from privado.avance_metas(v_mes, v_hoy, false) where usuario_id = v_yo and meta > 0),
    'semana', (select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'cantidad', cantidad, 'meta', meta)), '[]')
               from privado.avance_metas(v_sem, v_hoy, true) where usuario_id = v_yo and meta > 0));
end $function$;
revoke execute on function public.mi_meta() from public, anon;
grant execute on function public.mi_meta() to authenticated;
revoke execute on function privado.avance_metas(date, date, boolean) from public, anon, authenticated;

create table if not exists privado.metas_hitos (
  usuario_id bigint not null,
  periodo text not null,
  tipo text not null,
  hito int not null,
  created_at timestamptz not null default now(),
  primary key (usuario_id, periodo, tipo, hito)
);

-- Avisa el hito más alto que se acaba de pasar (no varios de golpe). Del mes: 50, 80 y 100 %; de la semana: 100 %.
create or replace function privado.revisar_metas(p_avisar boolean default true)
returns void language plpgsql security definer set search_path to '' as $function$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_mes date := date_trunc('month', v_hoy)::date;
  v_sem date := date_trunc('week', v_hoy)::date;
  r record; v_hito int; v_que text; v_falta int;
begin
  for r in select a.*, 'mes:' || to_char(v_mes, 'YYYY-MM') periodo, false semana from privado.avance_metas(v_mes, v_hoy, false) a where a.meta > 0
           union all
           select a.*, 'semana:' || v_sem, true from privado.avance_metas(v_sem, v_hoy, true) a where a.meta > 0 loop
    select max(h) into v_hito from unnest(case when r.semana then array[100] else array[50, 80, 100] end) h
    where r.cantidad * 100 >= r.meta * h
      and not exists (select 1 from privado.metas_hitos m where m.usuario_id = r.usuario_id and m.periodo = r.periodo and m.tipo = r.tipo and m.hito >= h);
    continue when v_hito is null;
    insert into privado.metas_hitos (usuario_id, periodo, tipo, hito)
    select r.usuario_id, r.periodo, r.tipo, h from unnest(case when r.semana then array[100] else array[50, 80, 100] end) h where h <= v_hito
    on conflict do nothing;
    continue when not p_avisar;

    v_que := case when r.tipo = 'vendedora' then 'ventas' else 'entregas' end;
    v_falta := r.meta - r.cantidad;
    if v_hito = 100 then
      perform privado.avisar(array[r.usuario_id], 'meta',
        case when r.semana then '🎉 ¡Cumpliste tu meta de la semana!' else '🏆 ¡Cumpliste tu meta del mes!' end,
        r.cantidad || ' de ' || r.meta || ' ' || v_que || '. ¡Excelente trabajo!', '/app/ranking', null);
      perform privado.avisar(privado.con_rol(array['admin']), 'meta',
        (select split_part(nombre, ' ', 1) from public.usuarios where id = r.usuario_id) || ' cumplió su meta ' || case when r.semana then 'de la semana' else 'del mes' end,
        r.cantidad || ' de ' || r.meta || ' ' || v_que, '/app/ranking', null);
    else
      perform privado.avisar(array[r.usuario_id], 'meta',
        '🔥 Vas en el ' || v_hito || ' % de tu meta del mes',
        r.cantidad || ' de ' || r.meta || ' ' || v_que || '. Te ' || case when v_falta = 1 then 'falta 1' else 'faltan ' || v_falta end || ', ¡tú puedes!',
        '/app/ranking', null);
    end if;
  end loop;
end $function$;

-- Lo que ya se había alcanzado antes de esto queda anotado sin avisar
select privado.revisar_metas(false);
select cron.schedule('avisos-metas', '*/10 * * * *', 'select privado.revisar_metas()');

-- ================================================================ 5. Garantía en el seguimiento
create or replace function public.seguimiento(p_codigo uuid)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'id', p.id, 'estado', p.estado, 'canal', p.canal, 'creado_at', p.created_at, 'alistado_at', p.alistado_at,
    'en_ruta_at', case when p.estado in ('despachado', 'entregado') then p.asignado_at end,
    'entregado_at', p.entregado_at,
    'cliente', split_part(trim(p.cliente_nombre), ' ', 1), 'barrio', p.barrio,
    'total', p.total, 'domicilio', p.valor_domicilio,
    'mensajero', case when p.estado in ('despachado', 'entregado') then split_part(trim(m.nombre), ' ', 1) end,
    'novedad', case when p.estado not in ('entregado', 'cancelado') then p.ultima_novedad end,
    'novedad_at', case when p.estado not in ('entregado', 'cancelado') then p.novedad_at end,
    'vendedora', split_part(trim(v.nombre), ' ', 1), 'vendedora_telefono', v.telefono,
    'negocio', c.nombre_negocio, 'telefonos', c.telefonos, 'garantia', c.texto_garantia,
    'calificacion', (select jsonb_build_object('estrellas', k.estrellas, 'comentario', k.comentario) from public.calificaciones k where k.pedido_id = p.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'color', i.color, 'talla', i.talla) order by i.id)
                        from public.pedido_items i where i.pedido_id = p.id), '[]'::jsonb))
  from public.pedidos p
  left join public.usuarios m on m.id = p.mensajero_id
  left join public.usuarios v on v.id = p.vendedora_id
  left join lateral (select nombre_negocio, telefonos, texto_garantia from public.configuracion limit 1) c on true
  where p.seguimiento = p_codigo
$function$;
