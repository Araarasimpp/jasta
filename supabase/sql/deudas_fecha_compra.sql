-- Deudas de compras de otras fechas (YA APLICADO 2026-11-04)
-- Una deuda puede llevar sus productos sin pasar por Inventario (compras viejas que no se registraron)
-- y una fecha desde la cual se cuenta lo vendido: todas las unidades de esos productos entregadas
-- desde ese día, hasta la cantidad comprada.

alter table public.deudas add column if not exists contar_desde date;

create table if not exists public.deuda_items (
  id bigint generated always as identity primary key,
  deuda_id bigint not null references public.deudas(id) on delete cascade,
  producto_id bigint not null references public.productos(id),
  nombre text not null,
  cantidad int not null check (cantidad > 0),
  costo numeric not null check (costo >= 0)
);
create index if not exists deuda_items_deuda_idx on public.deuda_items (deuda_id);
alter table public.deuda_items enable row level security;
revoke all on public.deuda_items from anon, authenticated;

-- Lo vendido de cada producto de una deuda
create or replace function privado.vendido_de_deuda(p_deuda bigint)
returns table(producto_id bigint, nombre text, cantidad int, costo numeric, vendidas int)
language plpgsql stable security definer set search_path to '' as $function$
declare d public.deudas; v_desde date;
begin
  select * into d from public.deudas where id = p_deuda;
  if not found then return; end if;
  v_desde := coalesce(d.contar_desde, case when d.compra_id is null then d.fecha end);
  if v_desde is null then
    -- Compra registrada en Inventario: lo entregado después de registrarla, menos el stock que ya había
    return query select * from privado.vendido_de_compra(d.compra_id);
    return;
  end if;
  return query
    with it as (
      select i.producto_id, i.nombre, i.cantidad, i.costo from public.compra_items i where d.compra_id is not null and i.compra_id = d.compra_id
      union all
      select i.producto_id, i.nombre, i.cantidad, i.costo from public.deuda_items i where d.compra_id is null and i.deuda_id = d.id
    )
    select it.producto_id, it.nombre, it.cantidad, it.costo,
      least(it.cantidad, coalesce((
        select sum(pi.cantidad) from public.pedido_items pi join public.pedidos p on p.id = pi.pedido_id
        where pi.producto_id = it.producto_id and p.estado = 'entregado'
          and coalesce(p.entregado_at, p.created_at) >= (v_desde::timestamp at time zone 'America/Bogota')), 0))::int
    from it;
end $function$;
revoke execute on function privado.vendido_de_deuda(bigint) from public, anon, authenticated;

-- La lista usa el cálculo nuevo (sirve con compra o con productos propios)
do $$
declare v text := pg_get_functiondef('public.deudas_lista(text)'::regprocedure);
begin
  if position('vendido_de_deuda' in v) = 0 then
    v := replace(v, 'from privado.vendido_de_compra(d.compra_id) s where d.compra_id is not null) v on true',
                    'from privado.vendido_de_deuda(d.id) s) v on true');
    v := replace(v, '''estado'', d.estado, ''compra_id'', d.compra_id,', '''estado'', d.estado, ''compra_id'', d.compra_id, ''contar_desde'', d.contar_desde,');
    if position('vendido_de_deuda' in v) = 0 or position('contar_desde' in v) = 0 then raise exception 'No se pudo cambiar deudas_lista'; end if;
    execute v;
  end if;
end $$;

-- Crear deuda: ahora puede llevar productos y la fecha desde la que se cuenta lo vendido
drop function if exists public.crear_deuda(text, text, numeric, date, date, bigint);
create or replace function public.crear_deuda(p_proveedor text, p_concepto text, p_total numeric, p_fecha date, p_vence date,
  p_compra bigint default null, p_items jsonb default null, p_contar_desde date default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare c public.compras; v_id bigint; v_total numeric := round(coalesce(p_total, 0)); v_prov text := privado.limpio(p_proveedor, 120);
  it jsonb; pr public.productos; v_cant int; v_costo numeric; v_sum numeric := 0; v_hay_items boolean := jsonb_typeof(p_items) = 'array' and jsonb_array_length(p_items) > 0;
begin
  perform privado.solo_admin();
  if p_compra is not null and v_hay_items then raise exception 'Una deuda lleva una compra o sus productos, no ambos'; end if;
  if p_contar_desde > (now() at time zone 'America/Bogota')::date then raise exception 'La fecha para contar lo vendido no puede ser después de hoy'; end if;
  if p_compra is not null then
    select * into c from public.compras where id = p_compra and not anulada;
    if not found then raise exception 'Esa compra no existe o está anulada'; end if;
    if exists (select 1 from public.deudas where compra_id = p_compra and estado <> 'anulada') then raise exception 'Esa compra ya está registrada como deuda'; end if;
    update public.deudas set compra_id = null where compra_id = p_compra and estado = 'anulada';
    v_prov := coalesce(v_prov, c.proveedor);
    if v_total <= 0 then v_total := c.total; end if;
  end if;
  if v_hay_items then
    if jsonb_array_length(p_items) > 80 then raise exception 'Son demasiados productos para una factura'; end if;
    for it in select x from jsonb_array_elements(p_items) x loop
      v_cant := coalesce((it->>'cantidad')::int, 0); v_costo := round(coalesce((it->>'costo')::numeric, 0));
      if v_cant <= 0 then raise exception 'Revisa las cantidades'; end if;
      if v_costo <= 0 then raise exception 'Revisa los costos'; end if;
      v_sum := v_sum + v_cant * v_costo;
    end loop;
    v_total := v_sum;
  end if;
  if v_prov is null or length(v_prov) < 2 then raise exception 'Escribe a quién se le debe'; end if;
  if v_total <= 0 then raise exception 'Escribe el valor de la deuda'; end if;
  insert into public.deudas (proveedor, concepto, total, fecha, vence, compra_id, contar_desde, creado_por, creado_por_nombre)
  values (v_prov, privado.limpio(p_concepto, 300), v_total, coalesce(p_fecha, c.fecha, (now() at time zone 'America/Bogota')::date), p_vence, p_compra,
          p_contar_desde, public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  if v_hay_items then
    for it in select x from jsonb_array_elements(p_items) x loop
      select * into pr from public.productos where id = (it->>'producto_id')::bigint;
      if not found then raise exception 'Uno de los productos ya no existe'; end if;
      insert into public.deuda_items (deuda_id, producto_id, nombre, cantidad, costo)
      values (v_id, pr.id, pr.nombre, (it->>'cantidad')::int, round((it->>'costo')::numeric));
    end loop;
  end if;
  return v_id;
end $function$;
revoke execute on function public.crear_deuda(text, text, numeric, date, date, bigint, jsonb, date) from public, anon;
grant execute on function public.crear_deuda(text, text, numeric, date, date, bigint, jsonb, date) to authenticated;

-- Editar: también la fecha desde la que se cuenta lo vendido (vacía = automático)
drop function if exists public.editar_deuda(bigint, text, text, numeric, date, date);
create or replace function public.editar_deuda(p_deuda bigint, p_proveedor text, p_concepto text, p_total numeric, p_fecha date, p_vence date,
  p_contar_desde date default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare d public.deudas; v_abonado numeric; v_total numeric := round(coalesce(p_total, 0)); v_prov text := privado.limpio(p_proveedor, 120);
begin
  perform privado.solo_admin();
  select * into d from public.deudas where id = p_deuda for update;
  if not found then raise exception 'Esa deuda no existe'; end if;
  if d.estado = 'anulada' then raise exception 'Esa deuda está anulada'; end if;
  if v_prov is null or length(v_prov) < 2 then raise exception 'Escribe a quién se le debe'; end if;
  if v_total <= 0 then raise exception 'Escribe el valor de la deuda'; end if;
  if p_fecha is null then raise exception 'Escribe la fecha'; end if;
  if p_fecha > (now() at time zone 'America/Bogota')::date or p_contar_desde > (now() at time zone 'America/Bogota')::date then
    raise exception 'Las fechas no pueden ser después de hoy';
  end if;
  select coalesce(sum(valor), 0) into v_abonado from public.deuda_abonos where deuda_id = d.id and not anulado;
  if v_total < v_abonado then raise exception 'Ya le has abonado %: el total no puede ser menor', privado.pesos(v_abonado); end if;
  update public.deudas set proveedor = v_prov, concepto = privado.limpio(p_concepto, 300), total = v_total, fecha = p_fecha, vence = p_vence,
    contar_desde = p_contar_desde, estado = case when v_abonado >= v_total then 'pagada' else 'abierta' end
   where id = d.id;
end $function$;
revoke execute on function public.editar_deuda(bigint, text, text, numeric, date, date, date) from public, anon;
grant execute on function public.editar_deuda(bigint, text, text, numeric, date, date, date) to authenticated;
