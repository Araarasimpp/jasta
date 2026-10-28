-- Estadísticas del catálogo público y clientes para recontactar (YA APLICADO)
--
-- 1) La tienda pública anota lo que pasa en cada catálogo (sin datos personales):
--    visita (abrió el enlace), ver (abrió un producto) y agregar (lo puso en el pedido).
--    Cada dispositivo lleva un código al azar; los repetidos del mismo día no cuentan dos veces.
-- 2) "Recontactar": clientes que ya compraron y llevan un tiempo sin volver, para escribirles
--    con el enlace del catálogo. La vendedora ve los suyos (su último pedido fue con ella).

-- ---------------------------------------------------------------- Eventos de la tienda
create table if not exists public.tienda_eventos (
  id bigint generated always as identity primary key,
  vendedora_id bigint references public.usuarios (id),
  tipo text not null check (tipo in ('visita', 'ver', 'agregar')),
  producto_id bigint,
  sesion text not null,
  created_at timestamptz not null default now()
);
create index if not exists tienda_eventos_vend_idx on public.tienda_eventos (vendedora_id, created_at desc);
create index if not exists tienda_eventos_sesion_idx on public.tienda_eventos (sesion, created_at desc);
alter table public.tienda_eventos enable row level security;
revoke all on public.tienda_eventos from anon, authenticated;

create or replace function public.tienda_evento(p_vendedora bigint, p_tipo text, p_producto bigint, p_sesion text)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_vid bigint := privado.vendedora_tienda(p_vendedora);
begin
  if p_tipo not in ('visita', 'ver', 'agregar') or coalesce(p_sesion, '') !~ '^[a-z0-9]{12,40}$' then return; end if;
  if p_vendedora is not null and v_vid is null then return; end if;
  -- Lo mismo en el mismo día cuenta una vez; y un tope por si alguien abusa
  if exists (select 1 from public.tienda_eventos where sesion = p_sesion and tipo = p_tipo and producto_id is not distinct from p_producto
             and created_at > now() - interval '12 hours') then return; end if;
  if (select count(*) from public.tienda_eventos where sesion = p_sesion and created_at > now() - interval '1 day') >= 300 then return; end if;
  insert into public.tienda_eventos (vendedora_id, tipo, producto_id, sesion) values (v_vid, p_tipo, p_producto, p_sesion);
end $function$;

-- Lo que ve la vendedora (o el admin, de todas) en "Pedidos de la tienda"
create or replace function public.tienda_estadisticas(p_dias integer)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_yo bigint := public.mi_usuario_id();
  v_admin boolean := public.tiene_rol('admin');
  v_desde timestamptz;
  v_hoy date := (now() at time zone 'America/Bogota')::date;
begin
  if v_yo is null or not (v_admin or public.tiene_rol('vendedora')) then raise exception 'Sin permiso'; end if;
  v_desde := ((v_hoy - greatest(1, least(coalesce(p_dias, 30), 365)) + 1)::text || ' 00:00 America/Bogota')::timestamptz;
  return (
    with ev as (
      select * from public.tienda_eventos e where e.created_at >= v_desde and (v_admin or e.vendedora_id = v_yo)
    ), pw as (
      select * from public.pedidos_web w where w.created_at >= v_desde and (v_admin or w.vendedora_id = v_yo)
    )
    select jsonb_build_object(
      'resumen', jsonb_build_object(
        'visitas', (select count(distinct sesion) from ev where tipo = 'visita'),
        'agregaron', (select count(distinct sesion) from ev where tipo = 'agregar'),
        'pedidos', (select count(*) from pw),
        'confirmados', (select count(*) from pw where estado = 'confirmado'),
        'ventas', (select coalesce(sum(subtotal + valor_domicilio), 0) from pw where estado = 'confirmado')),
      'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'visitas', coalesce(v.n, 0), 'pedidos', coalesce(p.n, 0)) order by d), '[]')
        from generate_series(v_desde at time zone 'America/Bogota', v_hoy::timestamp, interval '1 day') d
        left join (select (created_at at time zone 'America/Bogota')::date dia, count(distinct sesion) n from ev where tipo = 'visita' group by 1) v on v.dia = d::date
        left join (select (created_at at time zone 'America/Bogota')::date dia, count(*) n from pw group by 1) p on p.dia = d::date),
      'productos', (select coalesce(jsonb_agg(x order by (x->>'agregados')::int desc, (x->>'vistos')::int desc), '[]') from (
        select jsonb_build_object('id', pr.id, 'nombre', pr.nombre, 'imagen_url', pr.imagen_url,
          'vistos', count(distinct e.sesion) filter (where e.tipo = 'ver'), 'agregados', count(distinct e.sesion) filter (where e.tipo = 'agregar')) x
        from ev e join public.productos pr on pr.id = e.producto_id
        where e.tipo in ('ver', 'agregar') group by pr.id order by count(distinct e.sesion) filter (where e.tipo = 'agregar') desc,
          count(distinct e.sesion) filter (where e.tipo = 'ver') desc limit 8) s),
      'vendedoras', case when v_admin then (select coalesce(jsonb_agg(x order by (x->>'visitas')::int desc, (x->>'pedidos')::int desc), '[]') from (
        select jsonb_build_object('nombre', coalesce(u.nombre, 'Catálogo general'),
          'visitas', (select count(distinct sesion) from ev where tipo = 'visita' and ev.vendedora_id is not distinct from k.vid),
          'pedidos', (select count(*) from pw where pw.vendedora_id is not distinct from k.vid),
          'confirmados', (select count(*) from pw where pw.vendedora_id is not distinct from k.vid and estado = 'confirmado'),
          'ventas', (select coalesce(sum(subtotal + valor_domicilio), 0) from pw where pw.vendedora_id is not distinct from k.vid and estado = 'confirmado')) x
        from (select distinct vendedora_id vid from ev union select distinct vendedora_id from pw) k
        left join public.usuarios u on u.id = k.vid) s) end
    ));
end $function$;

-- ---------------------------------------------------------------- Recontactar
create table if not exists public.clientes_contactos (
  id bigint generated always as identity primary key,
  telefono text not null,
  usuario_id bigint not null references public.usuarios (id),
  created_at timestamptz not null default now()
);
create index if not exists clientes_contactos_tel_idx on public.clientes_contactos (telefono, created_at desc);
alter table public.clientes_contactos enable row level security;
revoke all on public.clientes_contactos from anon, authenticated;

-- Clientes cuyo último pedido entregado fue hace entre p_desde y p_hasta días
create or replace function public.recontactar(p_desde integer, p_hasta integer)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id(); v_admin boolean := public.tiene_rol('admin');
begin
  if v_yo is null or not (v_admin or public.tiene_rol('vendedora')) then raise exception 'Sin permiso'; end if;
  return (
    with base as (
      select regexp_replace(p.cliente_telefono, '\D', '', 'g') tel, p.*
      from public.pedidos p
      where p.estado = 'entregado' and p.cliente_telefono is not null and p.entregado_at is not null
    ), ult as (
      select distinct on (tel) tel, id, cliente_nombre, barrio, vendedora_id, entregado_at, cliente_telefono
      from base where length(tel) >= 7 order by tel, entregado_at desc
    ), agg as (
      select tel, count(*) compras, coalesce(sum(total), 0) total from base group by tel
    ), cli as (
      select u.*, ((now() at time zone 'America/Bogota')::date - (u.entregado_at at time zone 'America/Bogota')::date) dias, a.compras, a.total
      from ult u join agg a on a.tel = u.tel where v_admin or u.vendedora_id = v_yo
    ), conteos as (
      select jsonb_build_object(
        '30', count(*) filter (where dias between 30 and 59), '60', count(*) filter (where dias between 60 and 89),
        '90', count(*) filter (where dias between 90 and 179), '180', count(*) filter (where dias >= 180)) c
      from cli
    )
    select jsonb_build_object('conteos', (select c from conteos), 'lista', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object(
          'telefono', c.cliente_telefono, 'nombre', c.cliente_nombre, 'barrio', c.barrio, 'dias', c.dias, 'compras', c.compras, 'total', c.total,
          'ultima', c.entregado_at, 'vendedora', v.nombre,
          'productos', (select string_agg(i.nombre, ', ' order by i.id) from public.pedido_items i where i.pedido_id = c.id),
          'contactado', (select max(k.created_at) from public.clientes_contactos k where k.telefono = c.tel and k.created_at > now() - interval '30 days'),
          'marcado', exists (select 1 from public.clientes_alerta a where regexp_replace(a.telefono, '\D', '', 'g') = c.tel)) x
        from cli c left join public.usuarios v on v.id = c.vendedora_id
        where c.dias between p_desde and coalesce(p_hasta, 100000)
        order by c.compras desc, c.total desc, c.dias
        limit 150) s), '[]'::jsonb)));
end $function$;

create or replace function public.marcar_contactado(p_telefono text)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null or not (public.tiene_rol('admin') or public.tiene_rol('vendedora')) then raise exception 'Sin permiso'; end if;
  insert into public.clientes_contactos (telefono, usuario_id) values (regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), v_yo);
end $function$;

revoke execute on function public.tienda_evento(bigint, text, bigint, text), public.tienda_estadisticas(integer),
  public.recontactar(integer, integer), public.marcar_contactado(text) from public;
grant execute on function public.tienda_evento(bigint, text, bigint, text) to anon, authenticated;
grant execute on function public.tienda_estadisticas(integer), public.recontactar(integer, integer), public.marcar_contactado(text) to authenticated;

-- Supabase da EXECUTE a anon directamente (no por PUBLIC): se le quita en todo lo que no es del catálogo público
revoke execute on function public.recontactar(integer, integer), public.tienda_estadisticas(integer), public.marcar_contactado(text),
  public.pedidos_web_lista(), public.confirmar_pedido_web(bigint, numeric, text), public.cancelar_pedido_web(bigint, text),
  public.pedir_respaldo(), public.riesgo_cliente(text), public.marcar_cliente(text, text) from anon;
