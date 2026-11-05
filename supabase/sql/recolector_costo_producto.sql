-- El recolector registra la compra de un producto del inventario con lo que le costó, y el precio de
-- compra (costo) del producto se actualiza solo. (PENDIENTE DE APLICAR)

alter table public.recoleccion_compras
  add column if not exists producto_id bigint references public.productos(id),
  add column if not exists cantidad int,
  add column if not exists costo_unitario numeric,
  add column if not exists costo_anterior numeric;

-- Productos para elegir (el recolector no tiene acceso directo a la tabla de productos)
create or replace function public.recolector_productos()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not (public.tiene_rol('recolector') or public.tiene_rol('admin')) then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nombre', p.nombre, 'sku', p.sku, 'imagen_url', p.imagen_url, 'costo', p.precio_compra) order by p.nombre)
    from public.productos p where p.activo), '[]');
end $function$;
revoke execute on function public.recolector_productos() from public, anon;
grant execute on function public.recolector_productos() to authenticated;

drop function if exists public.recoleccion_registrar_compra(numeric, text, text, text[]);
create or replace function public.recoleccion_registrar_compra(p_valor numeric, p_proveedor text, p_producto text, p_facturas text[],
  p_producto_id bigint default null, p_cantidad int default null, p_costo numeric default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id(); v_ev text[]; v_id bigint; pr public.productos; v_valor numeric := p_valor; v_texto text := trim(coalesce(p_producto, ''));
  v_costo numeric := round(coalesce(p_costo, 0));
begin
  if not public.tiene_rol('recolector') then raise exception 'Solo el recolector registra compras'; end if;
  if coalesce(trim(p_proveedor), '') = '' then raise exception 'Escribe el proveedor'; end if;
  if p_producto_id is not null then
    select * into pr from public.productos where id = p_producto_id for update;
    if not found then raise exception 'Ese producto no existe'; end if;
    if coalesce(p_cantidad, 0) <= 0 then raise exception 'Escribe cuántos compraste'; end if;
    if v_costo <= 0 then raise exception 'Escribe cuánto te costó cada uno'; end if;
    v_valor := v_costo * p_cantidad;
    v_texto := p_cantidad || ' × ' || pr.nombre;
  end if;
  if coalesce(v_valor, 0) <= 0 then raise exception 'Escribe el valor de la compra'; end if;
  if v_texto = '' then raise exception 'Escribe qué compraste'; end if;
  v_ev := privado.comprobantes_validos(p_facturas);
  if cardinality(v_ev) = 0 then raise exception 'Sube la foto de la factura'; end if;
  insert into public.recoleccion_compras (recolector_id, valor, proveedor, producto, facturas, creada_por_nombre, producto_id, cantidad, costo_unitario, costo_anterior)
  values (v_yo, v_valor, left(trim(p_proveedor), 120), left(v_texto, 200), v_ev, public.mi_nombre(),
          pr.id, case when pr.id is not null then p_cantidad end, case when pr.id is not null then v_costo end, pr.precio_compra)
  returning id into v_id;
  -- El costo del producto queda con lo que le costó al recolector
  if pr.id is not null and pr.precio_compra is distinct from v_costo then
    update public.productos set precio_compra = v_costo, updated_at = now() where id = pr.id;
    perform privado.avisar(privado.con_rol(array['admin']), 'compras', '💲 Costo actualizado: ' || pr.nombre,
      'De ' || privado.pesos(coalesce(pr.precio_compra, 0)) || ' a ' || privado.pesos(v_costo) || ' · compra de ' || public.mi_nombre()
        || ' a ' || left(trim(p_proveedor), 60) || ' (' || p_cantidad || ' und)',
      '/app/recolector', null);
  end if;
  return v_id;
end $function$;
revoke execute on function public.recoleccion_registrar_compra(numeric, text, text, text[], bigint, int, numeric) from public, anon;
grant execute on function public.recoleccion_registrar_compra(numeric, text, text, text[], bigint, int, numeric) to authenticated;
