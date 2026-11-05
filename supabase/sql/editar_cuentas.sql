-- Editar entregas y abonos de Cuentas por cobrar (YA APLICADO 2026-11-05)
create or replace function public.editar_entrega_costo(p_entrega bigint, p_items jsonb, p_fecha date, p_nota text)
returns void language plpgsql security definer set search_path to '' as $function$
declare e public.cuenta_entregas; it jsonb; pr public.productos; v_cant int; v_costo numeric; v_total numeric := 0; v_saldo numeric;
begin
  perform privado.solo_admin_cuentas();
  select * into e from public.cuenta_entregas where id = p_entrega for update;
  if not found then raise exception 'Esa entrega no existe'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'La entrega debe tener al menos un producto'; end if;
  if p_fecha is null or p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'Revisa la fecha'; end if;
  -- Lo de antes vuelve al inventario y se descuenta lo nuevo
  update public.productos pr set stock = pr.stock + i.cantidad, updated_at = now()
    from public.cuenta_entrega_items i where i.entrega_id = e.id and i.producto_id = pr.id and pr.controla_stock;
  delete from public.cuenta_entrega_items where entrega_id = e.id;
  for it in select x from jsonb_array_elements(p_items) x loop
    select * into pr from public.productos where id = (it->>'producto_id')::bigint for update;
    if not found then raise exception 'Uno de los productos ya no existe'; end if;
    v_cant := coalesce((it->>'cantidad')::int, 0);
    if v_cant <= 0 then raise exception 'Revisa la cantidad de %', pr.nombre; end if;
    v_costo := round(coalesce((it->>'costo')::numeric, pr.precio_compra, 0));
    if v_costo < 0 then raise exception 'Revisa el costo de %', pr.nombre; end if;
    insert into public.cuenta_entrega_items (entrega_id, producto_id, nombre, cantidad, costo)
    values (e.id, pr.id, coalesce(nullif(trim(it->>'nombre'), ''), pr.nombre), v_cant, v_costo);
    if pr.controla_stock then update public.productos set stock = stock - v_cant, updated_at = now() where id = pr.id; end if;
    v_total := v_total + v_cant * v_costo;
  end loop;
  update public.cuenta_entregas set total = v_total, fecha = p_fecha, nota = privado.limpio(p_nota, 300) where id = e.id;
  select coalesce((select sum(total) from public.cuenta_entregas where cuenta_id = e.cuenta_id), 0)
       - coalesce((select sum(valor) from public.cuenta_abonos where cuenta_id = e.cuenta_id), 0) into v_saldo;
  if v_saldo < 0 then raise exception 'Con ese cambio lo entregado queda por debajo de lo que ya te abonó (sobran %)', privado.pesos(-v_saldo); end if;
end $function$;

create or replace function public.editar_abono_cuenta(p_abono bigint, p_valor numeric, p_metodo text, p_fecha date, p_nota text)
returns void language plpgsql security definer set search_path to '' as $function$
declare a public.cuenta_abonos; v_valor numeric := round(coalesce(p_valor, 0)); v_saldo numeric;
begin
  perform privado.solo_admin_cuentas();
  select * into a from public.cuenta_abonos where id = p_abono for update;
  if not found then raise exception 'Ese abono no existe'; end if;
  if coalesce(p_metodo, '') not in ('efectivo', 'transferencia', 'otro') then raise exception 'Forma de pago inválida'; end if;
  if v_valor <= 0 then raise exception 'Escribe el valor del abono'; end if;
  if p_fecha is null or p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'Revisa la fecha'; end if;
  update public.cuenta_abonos set valor = v_valor, metodo = p_metodo, fecha = p_fecha, nota = privado.limpio(p_nota, 300) where id = a.id;
  select coalesce((select sum(total) from public.cuenta_entregas where cuenta_id = a.cuenta_id), 0)
       - coalesce((select sum(valor) from public.cuenta_abonos where cuenta_id = a.cuenta_id), 0) into v_saldo;
  if v_saldo < 0 then raise exception 'Con ese valor los abonos pasan lo que debe (sobran %)', privado.pesos(-v_saldo); end if;
end $function$;

revoke execute on function public.editar_entrega_costo(bigint, jsonb, date, text), public.editar_abono_cuenta(bigint, numeric, text, date, text) from public, anon;
grant execute on function public.editar_entrega_costo(bigint, jsonb, date, text), public.editar_abono_cuenta(bigint, numeric, text, date, text) to authenticated;
