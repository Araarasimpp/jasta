-- Reseñas de productos y "Nuevo" en el catálogo (YA APLICADO 2026-11-05)
-- El cliente califica cada producto (1 a 5 estrellas y un comentario) desde la página de seguimiento,
-- cuando su pedido ya fue entregado. El catálogo muestra el promedio, cuántas reseñas tiene y si el
-- producto es nuevo (agregado en los últimos 15 días).

create table if not exists public.producto_resenas (
  id bigint generated always as identity primary key,
  producto_id bigint not null references public.productos(id) on delete cascade,
  pedido_id bigint not null references public.pedidos(id) on delete cascade,
  estrellas int not null check (estrellas between 1 and 5),
  comentario text,
  cliente text,
  created_at timestamptz not null default now(),
  unique (pedido_id, producto_id)
);
create index if not exists producto_resenas_producto_idx on public.producto_resenas (producto_id);
alter table public.producto_resenas enable row level security;
revoke all on public.producto_resenas from anon, authenticated;

-- Calificar los productos de un pedido entregado (con el código del seguimiento)
create or replace function public.calificar_productos(p_codigo uuid, p_resenas jsonb)
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; r jsonb; v_e int;
begin
  select * into p from public.pedidos where seguimiento = p_codigo;
  if not found then raise exception 'Ese pedido no existe'; end if;
  if p.estado <> 'entregado' then raise exception 'Puedes calificar cuando recibas tu pedido'; end if;
  if jsonb_typeof(p_resenas) <> 'array' then raise exception 'Calificación inválida'; end if;
  for r in select x from jsonb_array_elements(p_resenas) x loop
    v_e := (r->>'estrellas')::int;
    continue when v_e is null or v_e not between 1 and 5;
    continue when not exists (select 1 from public.pedido_items i where i.pedido_id = p.id and i.producto_id = (r->>'producto_id')::bigint);
    insert into public.producto_resenas (producto_id, pedido_id, estrellas, comentario, cliente)
    values ((r->>'producto_id')::bigint, p.id, v_e, privado.limpio(r->>'comentario', 400), split_part(trim(coalesce(p.cliente_nombre, '')), ' ', 1))
    on conflict (pedido_id, producto_id) do update set estrellas = excluded.estrellas, comentario = excluded.comentario, created_at = now();
  end loop;
end $function$;
grant execute on function public.calificar_productos(uuid, jsonb) to anon, authenticated;

-- Reseñas de un producto (las más recientes con comentario primero)
create or replace function public.tienda_resenas(p_producto bigint)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('estrellas', r.estrellas, 'comentario', r.comentario, 'cliente', r.cliente, 'fecha', r.created_at)
    order by (r.comentario is not null) desc, r.created_at desc), '[]')
  from (select * from public.producto_resenas where producto_id = p_producto order by (comentario is not null) desc, created_at desc limit 20) r
$$;
grant execute on function public.tienda_resenas(bigint) to anon, authenticated;

do $$
declare v text;
begin
  -- Catálogo: promedio de estrellas, cuántas reseñas y si es nuevo
  v := pg_get_functiondef('public.tienda(bigint)'::regprocedure);
  if position('''rating''' in v) = 0 then
    v := replace(v, '''top'', case when v.rk <= 10 then v.rk end)',
      '''top'', case when v.rk <= 10 then v.rk end,
        ''rating'', (select round(avg(r.estrellas)::numeric, 1) from public.producto_resenas r where r.producto_id = p.id),
        ''resenas'', (select count(*) from public.producto_resenas r where r.producto_id = p.id),
        ''nuevo'', p.created_at > now() - interval ''15 days'')');
    if position('''rating''' in v) = 0 then raise exception 'No se pudo cambiar tienda'; end if;
    execute v;
  end if;

  -- Seguimiento: cada producto trae su id y la calificación que ya le dio el cliente
  v := pg_get_functiondef('public.seguimiento(uuid)'::regprocedure);
  if position('''producto_id'', i.producto_id' in v) = 0 then
    v := replace(v, 'jsonb_build_object(''nombre'', i.nombre, ''cantidad'', i.cantidad,',
      'jsonb_build_object(''producto_id'', i.producto_id, ''resena'', (select r.estrellas from public.producto_resenas r where r.pedido_id = p.id and r.producto_id = i.producto_id),
        ''nombre'', i.nombre, ''cantidad'', i.cantidad,');
    if position('''producto_id'', i.producto_id' in v) = 0 then raise exception 'No se pudo cambiar seguimiento'; end if;
    execute v;
  end if;
end $$;
