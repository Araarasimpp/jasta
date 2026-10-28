-- Calificación de la entrega y recordatorio de cuadres pendientes (YA APLICADO)
--
-- 1) En la página de seguimiento, cuando el pedido ya se entregó, el cliente califica de
--    1 a 5 estrellas y puede dejar un comentario (una sola vez por pedido). Si califica 3 o
--    menos, les llega un aviso a los admins; si califica 5, al mensajero. En Reportes →
--    Por mensajero se ve el promedio de cada uno y los últimos comentarios.
-- 2) Todos los días a las 8:10 a. m. (Colombia), a cada mensajero con pedidos entregados
--    de días anteriores sin cuadrar le llega un aviso, y a los admins y a cuadres, el resumen
--    (más los cuadres cerrados que nadie ha recibido).

-- ---------------------------------------------------------------- Calificaciones
create table if not exists public.calificaciones (
  pedido_id bigint primary key references public.pedidos (id) on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  comentario text,
  mensajero_id bigint references public.usuarios (id),
  vendedora_id bigint references public.usuarios (id),
  created_at timestamptz not null default now()
);
create index if not exists calificaciones_fecha_idx on public.calificaciones (created_at desc);
alter table public.calificaciones enable row level security;
revoke all on public.calificaciones from anon, authenticated;

-- Pública: el cliente califica desde su enlace de seguimiento
create or replace function public.calificar_entrega(p_codigo uuid, p_estrellas integer, p_comentario text)
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_com text := nullif(left(trim(coalesce(p_comentario, '')), 300), ''); v_mens text; v_cli text;
begin
  if p_estrellas is null or p_estrellas not between 1 and 5 then raise exception 'Elige de 1 a 5 estrellas'; end if;
  select * into p from public.pedidos where seguimiento = p_codigo;
  if not found then raise exception 'No encontramos este pedido'; end if;
  if p.estado <> 'entregado' then raise exception 'Podrás calificar cuando te entreguen el pedido'; end if;
  if exists (select 1 from public.calificaciones where pedido_id = p.id) then raise exception 'Ya calificaste este pedido. ¡Gracias!'; end if;
  insert into public.calificaciones (pedido_id, estrellas, comentario, mensajero_id, vendedora_id)
  values (p.id, p_estrellas, v_com, p.mensajero_id, p.vendedora_id);
  select split_part(trim(nombre), ' ', 1) into v_mens from public.usuarios where id = p.mensajero_id;
  v_cli := split_part(trim(p.cliente_nombre), ' ', 1);
  if p_estrellas <= 3 then
    perform privado.avisar(privado.con_rol(array['admin']), 'calificacion_baja',
      repeat('★', p_estrellas) || repeat('☆', 5 - p_estrellas) || ' · pedido #' || p.id,
      v_cli || ' calificó la entrega' || coalesce(' de ' || v_mens, '') || coalesce(': "' || v_com || '"', ''),
      '/app/pedidos?id=' || p.id, p.id);
  elsif p_estrellas = 5 and p.mensajero_id is not null then
    perform privado.avisar(array[p.mensajero_id], 'calificacion_buena', '★★★★★ ¡Te calificaron con 5 estrellas!',
      v_cli || ' · pedido #' || p.id || coalesce(': "' || v_com || '"', ''), '/app/mis-entregas', p.id);
  end if;
end $function$;

-- La página de seguimiento ahora también devuelve la calificación (si ya la hizo)
create or replace function public.seguimiento(p_codigo uuid)
returns jsonb language sql stable security definer set search_path to '' as $function$
  select jsonb_build_object(
    'id', p.id, 'estado', p.estado, 'creado_at', p.created_at, 'alistado_at', p.alistado_at,
    'en_ruta_at', case when p.estado in ('despachado', 'entregado') then p.asignado_at end,
    'entregado_at', p.entregado_at,
    'cliente', split_part(trim(p.cliente_nombre), ' ', 1), 'barrio', p.barrio,
    'total', p.total, 'domicilio', p.valor_domicilio,
    'mensajero', case when p.estado in ('despachado', 'entregado') then split_part(trim(m.nombre), ' ', 1) end,
    'novedad', case when p.estado not in ('entregado', 'cancelado') then p.ultima_novedad end,
    'novedad_at', case when p.estado not in ('entregado', 'cancelado') then p.novedad_at end,
    'vendedora', split_part(trim(v.nombre), ' ', 1), 'vendedora_telefono', v.telefono,
    'negocio', c.nombre_negocio, 'telefonos', c.telefonos,
    'calificacion', (select jsonb_build_object('estrellas', k.estrellas, 'comentario', k.comentario) from public.calificaciones k where k.pedido_id = p.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'color', i.color, 'talla', i.talla) order by i.id)
                        from public.pedido_items i where i.pedido_id = p.id), '[]'::jsonb))
  from public.pedidos p
  left join public.usuarios m on m.id = p.mensajero_id
  left join public.usuarios v on v.id = p.vendedora_id
  left join lateral (select nombre_negocio, telefonos from public.configuracion limit 1) c on true
  where p.seguimiento = p_codigo
$function$;

-- Para Reportes (solo admin): promedio por mensajero y los últimos comentarios del periodo
create or replace function public.calificaciones_resumen(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  d timestamptz := (p_desde::text || ' 00:00 America/Bogota')::timestamptz;
  h timestamptz := ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'total', (select jsonb_build_object('cantidad', count(*), 'promedio', round(avg(estrellas), 1))
              from public.calificaciones where created_at >= d and created_at < h),
    'entregados', (select count(*) from public.pedidos where estado = 'entregado' and entregado_at >= d and entregado_at < h),
    'mensajeros', (select coalesce(jsonb_agg(x order by (x->>'promedio')::numeric desc, (x->>'cantidad')::int desc), '[]') from (
      select jsonb_build_object('nombre', coalesce(u.nombre, 'Sin mensajero'), 'cantidad', count(*), 'promedio', round(avg(k.estrellas), 1),
        'bajas', count(*) filter (where k.estrellas <= 3)) x
      from public.calificaciones k left join public.usuarios u on u.id = k.mensajero_id
      where k.created_at >= d and k.created_at < h group by u.id, u.nombre) s),
    'comentarios', (select coalesce(jsonb_agg(x), '[]') from (
      select jsonb_build_object('pedido_id', k.pedido_id, 'estrellas', k.estrellas, 'comentario', k.comentario, 'fecha', k.created_at,
        'cliente', split_part(trim(p.cliente_nombre), ' ', 1), 'mensajero', split_part(trim(u.nombre), ' ', 1)) x
      from public.calificaciones k join public.pedidos p on p.id = k.pedido_id left join public.usuarios u on u.id = k.mensajero_id
      where k.created_at >= d and k.created_at < h and k.comentario is not null
      order by k.created_at desc limit 15) s));
end $function$;

revoke execute on function public.calificar_entrega(uuid, integer, text), public.calificaciones_resumen(date, date) from public;
grant execute on function public.calificar_entrega(uuid, integer, text) to anon, authenticated;
grant execute on function public.calificaciones_resumen(date, date) to authenticated;
revoke execute on function public.calificaciones_resumen(date, date) from anon;

-- ---------------------------------------------------------------- Recordatorio de cuadres
create or replace function privado.recordar_cuadres()
returns integer language plpgsql security definer set search_path to '' as $function$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  r record;
  v_resumen text[] := '{}';
  v_por_recibir int;
  v_mes text[] := array['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  n int := 0;
begin
  for r in
    select p.mensajero_id, split_part(trim(u.nombre), ' ', 1) nombre, count(*) pedidos, coalesce(sum(p.valor_efectivo), 0) efectivo,
      string_agg(distinct extract(day from (p.entregado_at at time zone 'America/Bogota'))::int || ' ' ||
        v_mes[extract(month from (p.entregado_at at time zone 'America/Bogota'))::int], ', ') dias
    from public.pedidos p join public.usuarios u on u.id = p.mensajero_id
    where p.estado = 'entregado' and p.cuadre_id is null and u.activo
      and (p.entregado_at at time zone 'America/Bogota')::date < v_hoy
    group by p.mensajero_id, u.nombre
  loop
    perform privado.avisar(array[r.mensajero_id], 'cuadre_pendiente', 'Tienes cuadres sin cerrar',
      'Del ' || r.dias || ' · ' || r.pedidos || case when r.pedidos = 1 then ' pedido' else ' pedidos' end ||
      case when r.efectivo > 0 then ' · ' || privado.pesos(r.efectivo) || ' en efectivo' else '' end || '. Ciérralo hoy en Cuadres.',
      '/app/cuadres', null);
    v_resumen := v_resumen || (r.nombre || ' (' || r.dias || ')');
    n := n + 1;
  end loop;
  select count(*) into v_por_recibir from public.cuadres where estado = 'pendiente' and cerrado_at < now() - interval '12 hours';
  if n > 0 or v_por_recibir > 0 then
    perform privado.avisar(privado.con_rol(array['admin', 'cuadres']), 'cuadre_pendiente',
      case when n > 0 then n || case when n = 1 then ' mensajero con cuadre sin cerrar' else ' mensajeros con cuadres sin cerrar' end
           else 'Cuadres por recibir' end,
      concat_ws(' · ', nullif(array_to_string(v_resumen, ', '), ''),
        case when v_por_recibir > 0 then v_por_recibir || case when v_por_recibir = 1 then ' cuadre cerrado sin recibir' else ' cuadres cerrados sin recibir' end end),
      '/app/cuadres', null);
  end if;
  return n;
end $function$;
revoke execute on function privado.recordar_cuadres() from public, anon, authenticated;

-- 8:10 a. m. Colombia = 13:10 UTC
select cron.schedule('recordar-cuadres', '10 13 * * *', 'select privado.recordar_cuadres()');
