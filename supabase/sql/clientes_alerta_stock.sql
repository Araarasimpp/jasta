-- Clientes problemáticos y alertas de inventario (YA APLICADO)
--
-- 1) Al escribir el teléfono en Nuevo pedido, riesgo_cliente() cuenta su historial:
--    pedidos que salieron y se cancelaron (no recibió), novedades de entrega y
--    devoluciones, más la marca manual que el admin le haya puesto en Clientes.
-- 2) Cuando un producto con control de inventario baja a su mínimo o se agota, les
--    llega un aviso a los admins (campana + push), una vez por cada vez que cruza.

-- ---------------------------------------------------------------- Marca manual
create table if not exists public.clientes_alerta (
  telefono text primary key,
  nota text not null check (length(trim(nota)) between 1 and 300),
  autor text,
  created_at timestamptz not null default now()
);
alter table public.clientes_alerta enable row level security;
revoke all on public.clientes_alerta from anon, authenticated;

create or replace function public.marcar_cliente(p_telefono text, p_nota text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin puede marcar clientes'; end if;
  if nullif(trim(coalesce(p_telefono, '')), '') is null then raise exception 'Falta el teléfono'; end if;
  if nullif(trim(coalesce(p_nota, '')), '') is null then
    delete from public.clientes_alerta where telefono = trim(p_telefono);
  else
    insert into public.clientes_alerta (telefono, nota, autor) values (trim(p_telefono), left(trim(p_nota), 300), public.mi_nombre())
    on conflict (telefono) do update set nota = excluded.nota, autor = excluded.autor, created_at = now();
  end if;
end $function$;

-- ---------------------------------------------------------------- Historial del cliente
create or replace function public.riesgo_cliente(p_telefono text)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  m public.clientes_alerta;
  v_ped int; v_ent int; v_rech int; v_nov int; v_dev int; v_ult timestamptz; v_nivel text;
begin
  if not public.es_staff() then raise exception 'Sin permiso'; end if;
  select count(*), count(*) filter (where p.estado = 'entregado'),
         count(*) filter (where p.estado = 'cancelado' and p.mensajero_id is not null),
         coalesce(sum(p.novedades), 0),
         max(p.created_at) filter (where p.estado = 'cancelado' and p.mensajero_id is not null)
    into v_ped, v_ent, v_rech, v_nov, v_ult
    from public.pedidos p where p.cliente_telefono = p_telefono;
  select count(*) into v_dev from public.devoluciones d join public.pedidos x on x.id = d.pedido_id
   where x.cliente_telefono = p_telefono and d.tipo = 'devolucion';
  select * into m from public.clientes_alerta where telefono = p_telefono;
  v_nivel := case
    when m.telefono is not null or v_rech >= 2 or v_dev >= 2 or (v_rech >= 1 and v_ent = 0) then 'alto'
    when v_rech >= 1 or v_dev >= 1 or v_nov >= 3 then 'medio'
  end;
  return jsonb_build_object(
    'nivel', v_nivel, 'pedidos', v_ped, 'entregados', v_ent, 'rechazados', v_rech, 'novedades', v_nov,
    'devoluciones', v_dev, 'ultimo_rechazo', v_ult,
    'marca', case when m.telefono is null then null else jsonb_build_object('nota', m.nota, 'autor', m.autor, 'fecha', m.created_at) end);
end $function$;

revoke execute on function public.marcar_cliente(text, text), public.riesgo_cliente(text) from public, anon;
grant execute on function public.marcar_cliente(text, text), public.riesgo_cliente(text) to authenticated;

-- ---------------------------------------------------------------- Alertas de inventario
create or replace function privado.alerta_stock()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_tipo text; v_titulo text;
begin
  if not new.controla_stock or not new.activo or new.stock >= old.stock then return new; end if;
  if new.stock <= 0 and old.stock > 0 then
    v_tipo := 'agotado'; v_titulo := 'Se agotó: ' || new.nombre;
  elsif new.stock <= new.stock_minimo and old.stock > new.stock_minimo then
    v_tipo := 'stock_bajo'; v_titulo := 'Por acabarse: ' || new.nombre;
  else
    return new;
  end if;
  -- A todos los admins, también al que hizo el movimiento
  insert into public.notificaciones (usuario_id, tipo, titulo, cuerpo, url)
  select u.id, v_tipo, left(v_titulo, 120),
         case when new.stock <= 0 then 'No quedan unidades' else 'Quedan ' || new.stock || ' (mínimo ' || new.stock_minimo || ')' end,
         '/app/inventario'
    from public.usuarios u where u.activo and 'admin' = any (u.roles::text[]);
  return new;
end $function$;

revoke execute on function privado.alerta_stock() from public, anon, authenticated;
create or replace trigger productos_alerta_stock after update of stock on public.productos
  for each row execute function privado.alerta_stock();
