-- PENDIENTE: córrelo en el SQL Editor de Supabase (o dile a Claude "dale").
-- Quitar una compra del recolector.
-- · El admin quita cualquiera; el recolector solo las suyas y del mismo día (hora Colombia).
-- · Si esa compra fue la última que cambió el costo del producto, el costo vuelve al de antes.
-- · Si la quita el recolector, le llega un aviso al admin.
create or replace function public.recoleccion_borrar_compra(p_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.recoleccion_compras; v_admin boolean := public.tiene_rol('admin'); v_ultima bigint;
begin
  select * into c from public.recoleccion_compras where id = p_id for update;
  if not found then raise exception 'Esa compra ya no existe'; end if;
  if not v_admin then
    if not public.tiene_rol('recolector') or c.recolector_id is distinct from public.mi_usuario_id() then raise exception 'Sin permiso'; end if;
    if (c.created_at at time zone 'America/Bogota')::date <> (now() at time zone 'America/Bogota')::date then
      raise exception 'Solo puedes quitar compras de hoy. Pídele al admin que la quite.';
    end if;
  end if;
  if c.producto_id is not null and c.costo_anterior is not null then
    select id into v_ultima from public.recoleccion_compras
      where producto_id = c.producto_id and costo_unitario is not null order by created_at desc, id desc limit 1;
    if v_ultima = c.id then
      update public.productos set precio_compra = c.costo_anterior, updated_at = now()
        where id = c.producto_id and precio_compra = c.costo_unitario;
    end if;
  end if;
  delete from public.recoleccion_compras where id = c.id;
  if not v_admin then
    perform privado.avisar(privado.con_rol(array['admin']), 'compras', '🗑️ Compra quitada: ' || c.producto,
      public.mi_nombre() || ' quitó la compra de ' || privado.pesos(c.valor) || ' a ' || coalesce(c.proveedor, '—'), '/app/recolector', null);
  end if;
end $$;
revoke all on function public.recoleccion_borrar_compra(bigint) from public, anon;
grant execute on function public.recoleccion_borrar_compra(bigint) to authenticated;
