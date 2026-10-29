-- Barrios en el catálogo público (YA APLICADO)
--  - El barrio se compara sin tildes, mayúsculas ni espacios de más ("belen" = "Belén").
--  - Al confirmar un pedido de un barrio que no está en la tabla, se puede guardar con el valor
--    del domicilio que se cobró: el admin lo guarda directo; si es una vendedora, le avisa al admin.

-- 1) tienda_pedir: busca la tarifa con el barrio normalizado
do $$
declare v_def text := pg_get_functiondef('public.tienda_pedir(bigint, text, text, text, text, text, jsonb)'::regprocedure);
begin
  if position('lower(barrio) = lower(trim(p_barrio))' in v_def) = 0 then
    raise notice 'tienda_pedir ya estaba cambiada';
    return;
  end if;
  execute replace(v_def, 'lower(barrio) = lower(trim(p_barrio))', 'privado.barrio_normal(barrio) = privado.barrio_normal(p_barrio)');
end $$;

-- 2) confirmar_pedido_web con la opción de guardar el barrio nuevo
drop function if exists public.confirmar_pedido_web(bigint, numeric, text);
create or replace function public.confirmar_pedido_web(p_id bigint, p_domicilio numeric default null, p_nota text default null, p_guardar_barrio boolean default false)
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

  -- Barrio que no estaba en la tabla de domicilios
  if p_guardar_barrio and w.domicilio_por_confirmar and v_dom > 0 and length(trim(coalesce(w.barrio, ''))) >= 2
     and not exists (select 1 from public.tarifas_domicilio t where privado.barrio_normal(t.barrio) = privado.barrio_normal(w.barrio)) then
    if public.tiene_rol('admin') then
      insert into public.tarifas_domicilio (barrio, domicilio, activo) values (initcap(trim(w.barrio)), v_dom, true)
      on conflict do nothing;
    else
      perform privado.avisar(privado.con_rol(array['admin']), 'barrio_nuevo',
        'Barrio nuevo para la tabla: ' || initcap(trim(w.barrio)),
        public.mi_nombre() || ' cobró ' || privado.pesos(v_dom) || ' de domicilio en un pedido de la tienda. Agrégalo en Barrios para que la próxima vez salga solo.',
        '/app/barrios', null);
    end if;
  end if;
  return v_id;
end $function$;
revoke execute on function public.confirmar_pedido_web(bigint, numeric, text, boolean) from public, anon;
grant execute on function public.confirmar_pedido_web(bigint, numeric, text, boolean) to authenticated;
