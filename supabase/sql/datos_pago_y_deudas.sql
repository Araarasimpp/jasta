-- Datos de pago del equipo y deudas con proveedores (PENDIENTE DE APLICAR)

-- ================================================================ 1. Datos de pago (cédula y cuenta)
-- Privados: los ve y cambia la propia persona; el admin los ve para pagar. No van en usuarios
-- porque esa tabla la lee todo el equipo.
create table if not exists public.datos_pago (
  usuario_id bigint primary key references public.usuarios(id) on delete cascade,
  documento text,
  banco text,
  tipo_cuenta text check (tipo_cuenta is null or tipo_cuenta in ('ahorros', 'corriente', 'nequi', 'daviplata', 'otro')),
  numero_cuenta text,
  titular text,
  updated_at timestamptz not null default now()
);
alter table public.datos_pago enable row level security;
revoke all on public.datos_pago from anon, authenticated;

-- La cédula que se alcanzó a guardar en usuarios pasa a la tabla privada
insert into public.datos_pago (usuario_id, documento)
select id, documento from public.usuarios where documento is not null
on conflict (usuario_id) do update set documento = excluded.documento;

create or replace function privado.limpio(p text, n int) returns text language sql immutable set search_path to '' as $$
  select nullif(left(regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g'), n), '')
$$;

create or replace function public.mis_datos_pago()
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce((select to_jsonb(d) - 'usuario_id' from public.datos_pago d where d.usuario_id = public.mi_usuario_id()), '{}'::jsonb)
$$;

create or replace function public.guardar_mis_datos_pago(p_documento text, p_banco text, p_tipo text, p_numero text, p_titular text)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_yo bigint := public.mi_usuario_id();
begin
  if v_yo is null then raise exception 'Sin permiso'; end if;
  if p_tipo is not null and p_tipo <> '' and p_tipo not in ('ahorros', 'corriente', 'nequi', 'daviplata', 'otro') then raise exception 'Tipo de cuenta inválido'; end if;
  insert into public.datos_pago (usuario_id, documento, banco, tipo_cuenta, numero_cuenta, titular, updated_at)
  values (v_yo, privado.limpio(p_documento, 30), privado.limpio(p_banco, 60), nullif(p_tipo, ''), privado.limpio(p_numero, 40), privado.limpio(p_titular, 100), now())
  on conflict (usuario_id) do update set documento = excluded.documento, banco = excluded.banco, tipo_cuenta = excluded.tipo_cuenta,
    numero_cuenta = excluded.numero_cuenta, titular = excluded.titular, updated_at = now();
end $function$;

-- Datos de pago de alguien del equipo (admin), para pagarle
create or replace function public.datos_pago_de(p_usuario bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not (public.tiene_rol('admin') or p_usuario = public.mi_usuario_id()) then raise exception 'Sin permiso'; end if;
  return coalesce((select to_jsonb(d) - 'usuario_id' from public.datos_pago d where d.usuario_id = p_usuario), '{}'::jsonb);
end $function$;

-- El admin pone la cédula (desde el comprobante de egreso)
create or replace function public.guardar_documento(p_usuario bigint, p_documento text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  insert into public.datos_pago (usuario_id, documento) values (p_usuario, privado.limpio(p_documento, 30))
  on conflict (usuario_id) do update set documento = excluded.documento, updated_at = now();
end $function$;

-- El comprobante de egreso toma la cédula de la tabla privada
do $$
declare v_def text := regexp_replace(pg_get_functiondef('public.comprobante_liquidacion(bigint)'::regprocedure), E'\r', '', 'g');
begin
  if position('''documento'', u.documento' in v_def) > 0 then
    execute replace(v_def, '''documento'', u.documento', '''documento'', (select dp.documento from public.datos_pago dp where dp.usuario_id = u.id)');
  end if;
end $$;
alter table public.usuarios drop column if exists documento;

revoke execute on function public.mis_datos_pago(), public.guardar_mis_datos_pago(text, text, text, text, text), public.datos_pago_de(bigint) from public, anon;
grant execute on function public.mis_datos_pago(), public.guardar_mis_datos_pago(text, text, text, text, text), public.datos_pago_de(bigint) to authenticated;

-- ================================================================ 2. Deudas con proveedores
-- Una deuda puede salir de una compra registrada en Inventario (mercancía fiada) o ser otra deuda
-- (un préstamo, un servicio). De las que vienen de una compra se calcula cuántas unidades ya se
-- vendieron: lo vendido después de la compra, descontando el stock que ya había antes (se vende
-- primero lo viejo). El costo de lo vendido es la plata que ya entró por esa mercancía y conviene
-- apartar para abonarle al proveedor.
create table if not exists public.deudas (
  id bigint generated always as identity primary key,
  proveedor text not null check (length(trim(proveedor)) between 2 and 120),
  concepto text,
  total numeric not null check (total > 0),
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  vence date,
  compra_id bigint unique references public.compras(id),
  estado text not null default 'abierta' check (estado in ('abierta', 'pagada', 'anulada')),
  creado_por bigint references public.usuarios(id),
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
create table if not exists public.deuda_abonos (
  id bigint generated always as identity primary key,
  deuda_id bigint not null references public.deudas(id),
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  valor numeric not null check (valor > 0),
  metodo text not null default 'transferencia' check (metodo in ('efectivo', 'transferencia', 'otro')),
  comprobantes text[] not null default '{}',
  nota text,
  anulado boolean not null default false,
  creado_por bigint references public.usuarios(id),
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists deuda_abonos_deuda_idx on public.deuda_abonos (deuda_id);
alter table public.deudas enable row level security;
alter table public.deuda_abonos enable row level security;
revoke all on public.deudas, public.deuda_abonos from anon, authenticated;

create or replace function privado.solo_admin() returns void language plpgsql stable security definer set search_path to '' as $$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin maneja las deudas'; end if;
end $$;

-- Cuánto de cada producto de una compra ya se vendió
create or replace function privado.vendido_de_compra(p_compra bigint)
returns table(producto_id bigint, nombre text, cantidad int, costo numeric, vendidas int)
language sql stable security definer set search_path to '' as $$
  select i.producto_id, i.nombre, i.cantidad, i.costo,
    least(i.cantidad, greatest(coalesce((
      select sum(pi.cantidad) from public.pedido_items pi join public.pedidos p on p.id = pi.pedido_id
      where pi.producto_id = i.producto_id and p.estado = 'entregado' and p.entregado_at >= c.created_at), 0)
      - greatest(coalesce((select m.stock_antes from public.inventario_movimientos m
                           where m.compra_id = c.id and m.producto_id = i.producto_id and m.tipo = 'compra' order by m.id limit 1), 0), 0), 0))::int
  from public.compra_items i join public.compras c on c.id = i.compra_id
  where i.compra_id = p_compra
$$;

create or replace function public.deudas_lista(p_estado text default 'abiertas')
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  perform privado.solo_admin();
  return coalesce((select jsonb_agg(x order by (x->>'estado') = 'abierta' desc, x->>'vence' nulls last, (x->>'id')::bigint desc) from (
    select jsonb_build_object(
      'id', d.id, 'proveedor', d.proveedor, 'concepto', d.concepto, 'total', d.total, 'fecha', d.fecha, 'vence', d.vence,
      'estado', d.estado, 'compra_id', d.compra_id, 'creado_por', d.creado_por_nombre,
      'abonado', ab.abonado, 'saldo', greatest(d.total - ab.abonado, 0),
      'costo_vendido', v.costo_vendido, 'unidades', v.unidades, 'vendidas', v.vendidas,
      'por_apartar', least(greatest(coalesce(v.costo_vendido, 0) - ab.abonado, 0), greatest(d.total - ab.abonado, 0)),
      'items', v.items,
      'abonos', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'fecha', a.fecha, 'valor', a.valor, 'metodo', a.metodo,
                   'comprobantes', a.comprobantes, 'nota', a.nota, 'anulado', a.anulado, 'quien', a.creado_por_nombre) order by a.fecha desc, a.id desc), '[]')
                 from public.deuda_abonos a where a.deuda_id = d.id)) x
    from public.deudas d
    cross join lateral (select coalesce(sum(valor), 0) abonado from public.deuda_abonos a where a.deuda_id = d.id and not a.anulado) ab
    left join lateral (
      select sum(s.vendidas * s.costo) costo_vendido, sum(s.cantidad) unidades, sum(s.vendidas) vendidas,
        jsonb_agg(jsonb_build_object('producto_id', s.producto_id, 'nombre', s.nombre, 'cantidad', s.cantidad, 'costo', s.costo,
          'vendidas', s.vendidas, 'quedan', s.cantidad - s.vendidas) order by s.nombre) items
      from privado.vendido_de_compra(d.compra_id) s where d.compra_id is not null) v on true
    where case coalesce(p_estado, 'abiertas') when 'abiertas' then d.estado = 'abierta' when 'pagadas' then d.estado = 'pagada' else d.estado <> 'anulada' end
  ) s), '[]');
end $function$;

-- Compras de Inventario que todavía no son deuda (para convertirlas)
create or replace function public.compras_sin_deuda()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  perform privado.solo_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'fecha', c.fecha, 'proveedor', c.proveedor, 'total', c.total,
      'productos', (select string_agg(i.cantidad || ' × ' || i.nombre, ', ' order by i.id) from public.compra_items i where i.compra_id = c.id))
      order by c.fecha desc, c.id desc)
    from public.compras c
    where not c.anulada and c.fecha > (now() at time zone 'America/Bogota')::date - 120
      and not exists (select 1 from public.deudas d where d.compra_id = c.id and d.estado <> 'anulada')), '[]');
end $function$;

create or replace function public.crear_deuda(p_proveedor text, p_concepto text, p_total numeric, p_fecha date, p_vence date, p_compra bigint default null)
returns bigint language plpgsql security definer set search_path to '' as $function$
declare c public.compras; v_id bigint; v_total numeric := round(coalesce(p_total, 0)); v_prov text := privado.limpio(p_proveedor, 120);
begin
  perform privado.solo_admin();
  if p_compra is not null then
    select * into c from public.compras where id = p_compra and not anulada;
    if not found then raise exception 'Esa compra no existe o está anulada'; end if;
    if exists (select 1 from public.deudas where compra_id = p_compra and estado <> 'anulada') then raise exception 'Esa compra ya está registrada como deuda'; end if;
    -- Una deuda anulada de la misma compra se libera para poder registrarla otra vez
    update public.deudas set compra_id = null where compra_id = p_compra and estado = 'anulada';
    v_prov := coalesce(v_prov, c.proveedor);
    if v_total <= 0 then v_total := c.total; end if;
  end if;
  if v_prov is null or length(v_prov) < 2 then raise exception 'Escribe a quién se le debe'; end if;
  if v_total <= 0 then raise exception 'Escribe el valor de la deuda'; end if;
  insert into public.deudas (proveedor, concepto, total, fecha, vence, compra_id, creado_por, creado_por_nombre)
  values (v_prov, privado.limpio(p_concepto, 300), v_total, coalesce(p_fecha, c.fecha, (now() at time zone 'America/Bogota')::date), p_vence, p_compra,
          public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  return v_id;
end $function$;

create or replace function public.abonar_deuda(p_deuda bigint, p_valor numeric, p_metodo text, p_comprobantes text[], p_nota text, p_fecha date default null)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare d public.deudas; v_abonado numeric; v_valor numeric := round(coalesce(p_valor, 0)); v_saldo numeric;
begin
  perform privado.solo_admin();
  select * into d from public.deudas where id = p_deuda for update;
  if not found then raise exception 'Esa deuda no existe'; end if;
  if d.estado <> 'abierta' then raise exception 'Esa deuda ya está %', d.estado; end if;
  if coalesce(p_metodo, '') not in ('efectivo', 'transferencia', 'otro') then raise exception 'Forma de pago inválida'; end if;
  select coalesce(sum(valor), 0) into v_abonado from public.deuda_abonos where deuda_id = d.id and not anulado;
  if v_valor <= 0 then raise exception 'Escribe el valor del abono'; end if;
  if v_valor > d.total - v_abonado then raise exception 'El abono es más de lo que se debe (saldo %)', privado.pesos(d.total - v_abonado); end if;
  insert into public.deuda_abonos (deuda_id, fecha, valor, metodo, comprobantes, nota, creado_por, creado_por_nombre)
  values (d.id, coalesce(p_fecha, (now() at time zone 'America/Bogota')::date), v_valor, p_metodo, privado.comprobantes_validos(p_comprobantes),
          privado.limpio(p_nota, 300), public.mi_usuario_id(), public.mi_nombre());
  v_saldo := d.total - v_abonado - v_valor;
  if v_saldo <= 0 then update public.deudas set estado = 'pagada' where id = d.id; end if;
  return jsonb_build_object('saldo', v_saldo, 'pagada', v_saldo <= 0);
end $function$;

create or replace function public.anular_abono(p_abono bigint)
returns void language plpgsql security definer set search_path to '' as $function$
declare v_deuda bigint;
begin
  perform privado.solo_admin();
  update public.deuda_abonos set anulado = true where id = p_abono and not anulado returning deuda_id into v_deuda;
  if v_deuda is null then raise exception 'Ese abono no existe o ya está anulado'; end if;
  update public.deudas set estado = 'abierta' where id = v_deuda and estado = 'pagada';
end $function$;

create or replace function public.anular_deuda(p_deuda bigint)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  perform privado.solo_admin();
  update public.deudas set estado = 'anulada' where id = p_deuda and estado <> 'anulada';
  if not found then raise exception 'Esa deuda no existe o ya está anulada'; end if;
end $function$;

revoke execute on function public.deudas_lista(text), public.compras_sin_deuda(), public.crear_deuda(text, text, numeric, date, date, bigint),
  public.abonar_deuda(bigint, numeric, text, text[], text, date), public.anular_abono(bigint), public.anular_deuda(bigint) from public, anon;
grant execute on function public.deudas_lista(text), public.compras_sin_deuda(), public.crear_deuda(text, text, numeric, date, date, bigint),
  public.abonar_deuda(bigint, numeric, text, text[], text, date), public.anular_abono(bigint), public.anular_deuda(bigint) to authenticated;
revoke execute on function privado.vendido_de_compra(bigint), privado.solo_admin() from public, anon, authenticated;

-- Aviso al admin: deudas que vencen en 3 días o ya vencieron (8:25 a. m.)
create or replace function privado.recordar_deudas()
returns void language plpgsql security definer set search_path to '' as $function$
declare v_hoy date := (now() at time zone 'America/Bogota')::date; v_n int; v_saldo numeric; v_lista text;
begin
  select count(*), sum(greatest(d.total - coalesce(a.abonado, 0), 0)),
         string_agg(d.proveedor || case when d.vence < v_hoy then ' (vencida)' when d.vence = v_hoy then ' (hoy)' else ' (' || to_char(d.vence, 'DD/MM') || ')' end, ', ' order by d.vence)
    into v_n, v_saldo, v_lista
  from public.deudas d
  left join lateral (select sum(valor) abonado from public.deuda_abonos x where x.deuda_id = d.id and not x.anulado) a on true
  where d.estado = 'abierta' and d.vence is not null and d.vence <= v_hoy + 3;
  if v_n > 0 then
    perform privado.avisar(privado.con_rol(array['admin']), 'deuda',
      case when v_n = 1 then 'Una deuda vence pronto' else v_n || ' deudas vencen pronto' end,
      v_lista || ' · Saldo ' || privado.pesos(v_saldo), '/app/deudas', null);
  end if;
end $function$;
select cron.schedule('recordar-deudas', '25 13 * * *', 'select privado.recordar_deudas()');
