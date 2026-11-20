-- ============================================================================
--  Jasta · Recibir devoluciones en bodega y direcciones guardadas por cliente
--  YA APLICADO en Supabase (proyecto Jasta); se guarda como registro.
--
--  1. Cuando el mensajero reporta "No se pudo" y elige devolver el pedido a la
--     tienda, la novedad queda pendiente por recibir. Alistamiento la confirma
--     en Despachar → Recibir devoluciones (escaneando el rótulo o con el botón).
--  2. direcciones_cliente: las direcciones distintas que ha usado un cliente
--     (por teléfono), para escogerlas en Nuevo pedido.
-- ============================================================================

alter table public.pedido_novedades add column if not exists recibido_at timestamptz;
alter table public.pedido_novedades add column if not exists recibido_por text;
-- Lo que se devolvió antes de existir la recepción en bodega se dio por recibido (una sola vez):
-- update public.pedido_novedades set recibido_at = created_at, recibido_por = '(antes de la recepción en bodega)'
--  where accion = 'devolver' and recibido_at is null and created_at < now();

create or replace function public.devoluciones_por_recibir()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if not (public.tiene_rol('admin') or public.tiene_rol('alistador')) then raise exception 'Sin permiso'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('novedad', n.id, 'pedido', p.id, 'cliente', p.cliente_nombre, 'barrio', p.barrio,
             'mensajero', coalesce(u.nombre, n.autor), 'motivo', privado.motivo_novedad(n.motivo), 'detalle', n.detalle,
             'estado', p.estado, 'cuando', n.created_at) order by n.created_at)
      from public.pedido_novedades n
      join public.pedidos p on p.id = n.pedido_id
      left join public.usuarios u on u.id = n.mensajero_id
     where n.accion = 'devolver' and n.recibido_at is null), '[]'::jsonb);
end $function$;

create or replace function public.recibir_devolucion(p_pedido bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path to ''
as $function$
declare v_nov public.pedido_novedades; v_quien text := public.mi_nombre(); v_mens text; p public.pedidos;
begin
  if not (public.tiene_rol('admin') or public.tiene_rol('alistador')) then raise exception 'Sin permiso'; end if;
  select * into p from public.pedidos where id = p_pedido;
  if not found then return jsonb_build_object('ok', false, 'texto', 'No encontré el pedido #' || p_pedido || '.'); end if;
  select * into v_nov from public.pedido_novedades
   where pedido_id = p_pedido and accion = 'devolver' and recibido_at is null order by created_at desc limit 1 for update;
  if not found then
    return jsonb_build_object('ok', false, 'repetido', true, 'texto', 'El #' || p_pedido || ' (' || p.cliente_nombre || ') no tiene una devolución pendiente por recibir.');
  end if;
  update public.pedido_novedades set recibido_at = now(), recibido_por = v_quien
   where pedido_id = p_pedido and accion = 'devolver' and recibido_at is null;
  select nombre into v_mens from public.usuarios where id = v_nov.mensajero_id;
  perform public.nota(p_pedido, 'Devolución recibida en bodega' || coalesce(' (la trajo ' || v_mens || ')', ''));
  return jsonb_build_object('ok', true, 'texto', 'Recibido en bodega: #' || p_pedido || ' · ' || p.cliente_nombre || coalesce(' · lo trajo ' || v_mens, ''));
end $function$;

create or replace function public.direcciones_cliente(p_telefono text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('direccion', d.direccion, 'barrio', d.barrio, 'valor_domicilio', d.valor_domicilio,
           'veces', d.veces, 'ultima', d.ultima) order by d.ultima desc), '[]'::jsonb)
  from (
    select * from (
      select distinct on (lower(regexp_replace(p.direccion, '[^a-zA-Z0-9]', '', 'g')), lower(coalesce(p.barrio, '')))
             p.direccion, p.barrio, p.valor_domicilio, p.created_at as ultima,
             count(*) over (partition by lower(regexp_replace(p.direccion, '[^a-zA-Z0-9]', '', 'g')), lower(coalesce(p.barrio, ''))) as veces
        from public.pedidos p
       where p.cliente_telefono = p_telefono and public.es_staff()
         and p.canal = 'domicilio' and length(trim(coalesce(p.direccion, ''))) > 3 and p.estado <> 'cancelado'
       order by lower(regexp_replace(p.direccion, '[^a-zA-Z0-9]', '', 'g')), lower(coalesce(p.barrio, '')), p.created_at desc
    ) x order by x.ultima desc limit 6
  ) d
$function$;
