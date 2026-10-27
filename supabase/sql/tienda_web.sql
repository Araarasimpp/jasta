-- Tienda web: catálogo público por vendedora con pedido directo (YA APLICADO)
--
-- Cada vendedora comparte su enlace (/tienda/<nombre>-<id>); el general es /tienda.
-- El cliente ve los productos activos al precio de venta sugerido (no se puede cambiar),
-- los agotados con su etiqueta, arma el carrito y deja sus datos. El pedido queda en
-- public.pedidos_web "por confirmar": a la vendedora le llega el aviso, llama al cliente
-- y lo confirma (ahí se crea el pedido normal, a su nombre) o lo cancela.

create table if not exists public.pedidos_web (
  id bigint generated always as identity primary key,
  vendedora_id bigint references public.usuarios (id),
  estado text not null default 'por_confirmar' check (estado in ('por_confirmar', 'confirmado', 'cancelado')),
  cliente_nombre text not null,
  cliente_telefono text not null,
  direccion text not null,
  barrio text not null,
  observaciones text,
  valor_domicilio numeric not null default 0,
  domicilio_por_confirmar boolean not null default false,
  items jsonb not null,
  subtotal numeric not null,
  ip text,
  pedido_id bigint references public.pedidos (id),
  motivo text,
  atendido_por text,
  atendido_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists pedidos_web_estado_idx on public.pedidos_web (estado, created_at desc);
create index if not exists pedidos_web_tel_idx on public.pedidos_web (cliente_telefono, created_at desc);
alter table public.pedidos_web enable row level security;
revoke all on public.pedidos_web from anon, authenticated;

-- Vendedora del enlace (null = tienda general)
create or replace function privado.vendedora_tienda(p_vendedora bigint)
returns bigint language sql stable security definer set search_path to '' as $$
  select id from public.usuarios where id = p_vendedora and activo and 'vendedora' = any (roles::text[])
$$;

-- ---------------------------------------------------------------- Catálogo (público)
create or replace function public.tienda(p_vendedora bigint default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_vend public.usuarios; v_vid bigint;
begin
  v_vid := privado.vendedora_tienda(p_vendedora);
  if p_vendedora is not null and v_vid is null then return null; end if;
  select * into v_vend from public.usuarios where id = v_vid;
  return jsonb_build_object(
    'negocio', (select nombre_negocio from public.configuracion limit 1),
    'telefonos', (select telefonos from public.configuracion limit 1),
    'vendedora', case when v_vid is null then null
                 else jsonb_build_object('id', v_vend.id, 'nombre', v_vend.nombre, 'telefono', v_vend.telefono) end,
    'barrios', (select coalesce(jsonb_agg(jsonb_build_object('barrio', barrio, 'domicilio', domicilio) order by barrio), '[]')
                from public.tarifas_domicilio where activo),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'precio', p.precio_venta,
        'imagen_url', p.imagen_url, 'tallas', coalesce(p.tallas, '{}'),
        'colores', (select coalesce(jsonb_agg(jsonb_build_object('nombre', c.nombre, 'hex', c.hex, 'imagen_url', c.imagen_url) order by c.orden, c.id), '[]')
                    from public.producto_colores c where c.producto_id = p.id),
        'agotado', p.controla_stock and p.stock <= 0,
        'disponibles', case when p.controla_stock then greatest(p.stock, 0) end)
      order by (p.controla_stock and p.stock <= 0), coalesce(v.n, 0) desc, p.nombre), '[]')
      from public.productos p
      left join (select i.producto_id, sum(i.cantidad) n from public.pedido_items i join public.pedidos x on x.id = i.pedido_id
                 where x.created_at > now() - interval '30 days' and x.estado <> 'cancelado' group by 1) v on v.producto_id = p.id
      where p.activo));
end $function$;

-- Descripción y fotos de un producto (al abrirlo, para no cargar todo el catálogo de una vez)
create or replace function public.tienda_producto(p_id bigint)
returns jsonb language sql stable security definer set search_path to '' as $$
  select jsonb_build_object('descripcion', descripcion, 'imagenes', coalesce(imagenes, '{}'))
  from public.productos where id = p_id and activo
$$;
revoke execute on function public.tienda_producto(bigint) from public;
grant execute on function public.tienda_producto(bigint) to anon, authenticated;

-- ---------------------------------------------------------------- Pedir (público)
create or replace function public.tienda_pedir(p_vendedora bigint, p_nombre text, p_telefono text, p_direccion text,
  p_barrio text, p_observaciones text, p_items jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_vid bigint := privado.vendedora_tienda(p_vendedora);
  v_ip text := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  v_tel text := trim(coalesce(p_telefono, ''));
  v_nombre text := regexp_replace(trim(coalesce(p_nombre, '')), '\s{2,}', ' ', 'g');
  it jsonb; pr public.productos; v_cant int; v_color text; v_talla text;
  v_items jsonb := '[]'; v_sub numeric := 0; v_dom numeric; v_id bigint; v_dest bigint[];
begin
  if p_vendedora is not null and v_vid is null then raise exception 'Este enlace ya no está activo'; end if;
  if v_nombre !~ '\w' or v_nombre ~ '[0-9]' or length(v_nombre) > 80 then raise exception 'Escribe tu nombre (solo letras)'; end if;
  if v_tel !~ '^(3[0-9]{9}|60[0-9]{8}|\+[0-9]{1,4} [0-9]{6,14})$' then raise exception 'Revisa tu número de celular'; end if;
  if length(trim(coalesce(p_direccion, ''))) < 5 then raise exception 'Escribe tu dirección completa'; end if;
  if length(trim(coalesce(p_barrio, ''))) < 2 then raise exception 'Escribe tu barrio'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Tu pedido está vacío'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'Son demasiados productos para un solo pedido'; end if;

  -- Freno a pedidos repetidos o de robots
  if (select count(*) from public.pedidos_web where cliente_telefono = v_tel and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Ya recibimos varios pedidos de este número hoy. Escríbenos por WhatsApp para ayudarte.';
  end if;
  if v_ip <> '' and (select count(*) from public.pedidos_web where ip = v_ip and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Se enviaron muchos pedidos desde esta conexión. Intenta más tarde.';
  end if;
  if (select count(*) from public.pedidos_web where created_at > now() - interval '10 minutes') >= 40 then
    raise exception 'Estamos recibiendo muchos pedidos. Intenta en unos minutos.';
  end if;

  for it in select x from jsonb_array_elements(p_items) x loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint and activo;
    if not found then raise exception 'Uno de los productos ya no está disponible. Revisa tu pedido.'; end if;
    v_cant := coalesce((it->>'cantidad')::int, 0);
    if v_cant < 1 or v_cant > 20 then raise exception 'Revisa la cantidad de %', pr.nombre; end if;
    if pr.controla_stock and pr.stock <= 0 then raise exception '% está agotado', pr.nombre; end if;
    if pr.controla_stock and v_cant > pr.stock then raise exception 'De % solo quedan %', pr.nombre, pr.stock; end if;
    v_color := nullif(left(trim(coalesce(it->>'color', '')), 40), '');
    v_talla := nullif(left(trim(coalesce(it->>'talla', '')), 40), '');
    if exists (select 1 from public.producto_colores c where c.producto_id = pr.id)
       and not exists (select 1 from public.producto_colores c where c.producto_id = pr.id and c.nombre = v_color) then
      raise exception 'Elige el color de %', pr.nombre;
    end if;
    if cardinality(coalesce(pr.tallas, '{}')) > 0 and not (v_talla = any (pr.tallas)) then
      raise exception 'Elige la talla de %', pr.nombre;
    end if;
    -- Siempre al precio de venta sugerido del producto
    v_items := v_items || jsonb_build_object('producto_id', pr.id, 'nombre', pr.nombre, 'cantidad', v_cant,
      'precio', pr.precio_venta, 'color', v_color, 'talla', v_talla);
    v_sub := v_sub + pr.precio_venta * v_cant;
  end loop;

  select domicilio into v_dom from public.tarifas_domicilio where activo and lower(barrio) = lower(trim(p_barrio)) limit 1;

  insert into public.pedidos_web (vendedora_id, cliente_nombre, cliente_telefono, direccion, barrio, observaciones,
    valor_domicilio, domicilio_por_confirmar, items, subtotal, ip)
  values (v_vid, v_nombre, v_tel, left(trim(p_direccion), 200), left(trim(p_barrio), 120), nullif(left(trim(coalesce(p_observaciones, '')), 300), ''),
    coalesce(v_dom, 0), v_dom is null, v_items, v_sub, nullif(v_ip, ''))
  returning id into v_id;

  v_dest := case when v_vid is null then privado.con_rol(array['admin']) else array[v_vid] end;
  perform privado.avisar(v_dest, 'pedido_web', 'Pedido de la tienda: ' || split_part(v_nombre, ' ', 1) || ' · ' || privado.pesos(v_sub + coalesce(v_dom, 0)),
    'Llama al cliente y confírmalo · ' || trim(p_barrio), '/app/pedidos-web', null);

  return jsonb_build_object('id', v_id, 'subtotal', v_sub, 'domicilio', coalesce(v_dom, 0), 'domicilio_por_confirmar', v_dom is null);
end $function$;

-- ---------------------------------------------------------------- Atender (equipo)
create or replace function public.pedidos_web_lista()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id(); v_admin boolean := public.tiene_rol('admin');
begin
  if v_yo is null or not (v_admin or public.tiene_rol('vendedora')) then raise exception 'Sin permiso'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', w.id, 'estado', w.estado, 'vendedora', u.nombre, 'cliente_nombre', w.cliente_nombre, 'cliente_telefono', w.cliente_telefono,
      'direccion', w.direccion, 'barrio', w.barrio, 'observaciones', w.observaciones, 'valor_domicilio', w.valor_domicilio,
      'domicilio_por_confirmar', w.domicilio_por_confirmar, 'items', w.items, 'subtotal', w.subtotal, 'pedido_id', w.pedido_id,
      'motivo', w.motivo, 'atendido_por', w.atendido_por, 'atendido_at', w.atendido_at, 'created_at', w.created_at,
      'riesgo', case when w.estado = 'por_confirmar' then public.riesgo_cliente(w.cliente_telefono) end)
    order by (w.estado = 'por_confirmar') desc, w.created_at desc), '[]')
    from public.pedidos_web w left join public.usuarios u on u.id = w.vendedora_id
    where (v_admin or w.vendedora_id = v_yo)
      and (w.estado = 'por_confirmar' or w.created_at > now() - interval '30 days'));
end $function$;

create or replace function public.confirmar_pedido_web(p_id bigint, p_domicilio numeric default null, p_nota text default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare w public.pedidos_web; v_yo bigint := public.mi_usuario_id(); v_id bigint; it jsonb; pr public.productos; v_dom numeric; v_sub numeric := 0;
begin
  select * into w from public.pedidos_web where id = p_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if not (public.tiene_rol('admin') or (w.vendedora_id = v_yo and public.tiene_rol('vendedora'))) then raise exception 'Sin permiso'; end if;
  if w.estado <> 'por_confirmar' then raise exception 'Este pedido ya fue atendido'; end if;
  v_dom := coalesce(p_domicilio, w.valor_domicilio);
  if v_dom < 0 or v_dom > 1000000 then raise exception 'Revisa el valor del domicilio'; end if;

  insert into public.pedidos (estado, vendedora_id, cliente_nombre, cliente_telefono, direccion, barrio, observaciones, valor_domicilio)
  values ('por_alistar', coalesce(w.vendedora_id, v_yo), w.cliente_nombre, w.cliente_telefono, w.direccion, w.barrio,
          nullif(concat_ws(' · ', w.observaciones, nullif(trim(coalesce(p_nota, '')), '')), ''), v_dom)
  returning id into v_id;
  for it in select x from jsonb_array_elements(w.items) x loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint;
    if not found then raise exception 'El producto % ya no existe', it->>'nombre'; end if;
    insert into public.pedido_items (pedido_id, producto_id, nombre, cantidad, precio_venta, precio_base, precio_compra, total, color, talla)
    values (v_id, pr.id, pr.nombre, (it->>'cantidad')::int, (it->>'precio')::numeric, pr.precio_base, pr.precio_compra,
            (it->>'precio')::numeric * (it->>'cantidad')::int, it->>'color', it->>'talla');
    v_sub := v_sub + (it->>'precio')::numeric * (it->>'cantidad')::int;
  end loop;
  update public.pedidos set total = v_sub + v_dom where id = v_id;
  perform public.nota(v_id, 'Pedido de la tienda web, confirmado con el cliente');
  update public.pedidos_web set estado = 'confirmado', pedido_id = v_id, valor_domicilio = v_dom, atendido_por = public.mi_nombre(), atendido_at = now()
   where id = p_id;
  return v_id;
end $function$;

create or replace function public.cancelar_pedido_web(p_id bigint, p_motivo text)
returns void language plpgsql security definer set search_path to '' as $function$
declare w public.pedidos_web; v_yo bigint := public.mi_usuario_id();
begin
  select * into w from public.pedidos_web where id = p_id for update;
  if not found then raise exception 'El pedido no existe'; end if;
  if not (public.tiene_rol('admin') or (w.vendedora_id = v_yo and public.tiene_rol('vendedora'))) then raise exception 'Sin permiso'; end if;
  if w.estado <> 'por_confirmar' then raise exception 'Este pedido ya fue atendido'; end if;
  if nullif(trim(coalesce(p_motivo, '')), '') is null then raise exception 'Escribe por qué se cancela'; end if;
  update public.pedidos_web set estado = 'cancelado', motivo = left(trim(p_motivo), 200), atendido_por = public.mi_nombre(), atendido_at = now()
   where id = p_id;
end $function$;

revoke execute on function privado.vendedora_tienda(bigint) from public, anon, authenticated;
revoke execute on function public.tienda(bigint), public.tienda_pedir(bigint, text, text, text, text, text, jsonb),
  public.pedidos_web_lista(), public.confirmar_pedido_web(bigint, numeric, text), public.cancelar_pedido_web(bigint, text) from public;
grant execute on function public.tienda(bigint), public.tienda_pedir(bigint, text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.pedidos_web_lista(), public.confirmar_pedido_web(bigint, numeric, text), public.cancelar_pedido_web(bigint, text) to authenticated;
