-- Cuadre de caja, pedidos duplicados y pedidos quietos (YA APLICADO)

-- ================================================================ Cuadre de caja del local (arqueo)
-- Quien vende en el local cuenta el efectivo al cerrar; se compara con lo que debería haber
-- (base con la que abrió + efectivo de las ventas del día). Si falta o sobra, se le avisa al admin.
create table if not exists public.cierres_caja (
  fecha date primary key,
  base numeric not null default 0 check (base >= 0),
  efectivo_ventas numeric not null default 0,
  esperado numeric not null default 0,
  contado numeric not null check (contado >= 0),
  diferencia numeric not null default 0,
  nota text,
  usuario_id bigint references public.usuarios(id),
  usuario_nombre text,
  updated_at timestamptz not null default now()
);
alter table public.cierres_caja enable row level security;
revoke all on public.cierres_caja from anon, authenticated;

create or replace function privado.puede_caja() returns boolean language sql stable security definer set search_path to '' as $$
  select public.tiene_rol('admin') or public.tiene_rol('venta_local')
$$;

-- Lo de la caja de un día: lo que debería haber y el conteo (si ya se hizo)
create or replace function public.caja_local(p_fecha date default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_dia date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  l jsonb := privado.cierre_local(v_dia);
  c public.cierres_caja;
begin
  if not privado.puede_caja() then raise exception 'Sin permiso'; end if;
  select * into c from public.cierres_caja where fecha = v_dia;
  return jsonb_build_object(
    'fecha', v_dia,
    'ventas', (l->>'ventas')::int,
    'total', (l->>'total')::numeric,
    'efectivo', (l->>'efectivo')::numeric,
    'transferencia', (l->>'transferencia')::numeric,
    -- La base se sugiere con la del último cuadre
    'base_sugerida', coalesce(c.base, (select base from public.cierres_caja where fecha < v_dia order by fecha desc limit 1), 0),
    'cierre', case when c.fecha is null then null else jsonb_build_object(
      'base', c.base, 'esperado', c.esperado, 'contado', c.contado, 'diferencia', c.diferencia, 'nota', c.nota,
      'quien', c.usuario_nombre, 'hora', c.updated_at) end);
end $function$;

create or replace function public.cuadrar_caja(p_fecha date, p_base numeric, p_contado numeric, p_nota text)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v_dia date := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);
  v_efe numeric := (privado.cierre_local(v_dia)->>'efectivo')::numeric;
  v_base numeric := round(greatest(coalesce(p_base, 0), 0));
  v_contado numeric := round(coalesce(p_contado, -1));
  v_esp numeric; v_dif numeric; v_nota text := nullif(left(trim(coalesce(p_nota, '')), 300), '');
begin
  if not privado.puede_caja() then raise exception 'Sin permiso'; end if;
  if v_contado < 0 then raise exception 'Escribe cuánto efectivo contaste'; end if;
  if v_dia > (now() at time zone 'America/Bogota')::date then raise exception 'Esa fecha todavía no ha llegado'; end if;
  if v_dia < (now() at time zone 'America/Bogota')::date - 7 and not public.tiene_rol('admin') then
    raise exception 'Solo el admin puede cuadrar días de hace más de una semana';
  end if;
  v_esp := v_base + v_efe;
  v_dif := v_contado - v_esp;
  insert into public.cierres_caja (fecha, base, efectivo_ventas, esperado, contado, diferencia, nota, usuario_id, usuario_nombre, updated_at)
  values (v_dia, v_base, v_efe, v_esp, v_contado, v_dif, v_nota, public.mi_usuario_id(), public.mi_nombre(), now())
  on conflict (fecha) do update set base = excluded.base, efectivo_ventas = excluded.efectivo_ventas, esperado = excluded.esperado,
    contado = excluded.contado, diferencia = excluded.diferencia, nota = excluded.nota, usuario_id = excluded.usuario_id,
    usuario_nombre = excluded.usuario_nombre, updated_at = now();

  perform privado.avisar(privado.con_rol(array['admin']), 'caja',
    case when v_dif = 0 then 'Caja del local cuadrada ✓'
         when v_dif < 0 then 'Caja del local: faltan ' || privado.pesos(-v_dif)
         else 'Caja del local: sobran ' || privado.pesos(v_dif) end,
    public.mi_nombre() || ' contó ' || privado.pesos(v_contado) || ' · debía haber ' || privado.pesos(v_esp)
      || coalesce(' · "' || v_nota || '"', ''),
    '/app/ventas-local', null);
  return jsonb_build_object('esperado', v_esp, 'contado', v_contado, 'diferencia', v_dif);
end $function$;
revoke execute on function public.caja_local(date), public.cuadrar_caja(date, numeric, numeric, text) from public, anon;
grant execute on function public.caja_local(date), public.cuadrar_caja(date, numeric, numeric, text) to authenticated;

-- El aviso de las 9 p. m. recuerda contar la caja si nadie lo ha hecho
create or replace function privado.enviar_cierre_dia(p_dia date default null)
returns integer language plpgsql security definer set search_path to '' as $function$
declare v_token text; v_texto text; r record; n int := 0; v_dia date := coalesce(p_dia, (now() at time zone 'America/Bogota')::date);
  l jsonb := privado.cierre_local(v_dia);
  v_contada boolean := exists (select 1 from public.cierres_caja where fecha = v_dia);
begin
  if (l->>'ventas')::int > 0 then
    perform privado.avisar(privado.con_rol(array['admin', 'venta_local']), 'cierre_local',
      'Cierre del local · ' || (l->>'ventas') || case when (l->>'ventas')::int = 1 then ' venta · ' else ' ventas · ' end || privado.pesos((l->>'total')::numeric),
      'Efectivo de las ventas: ' || privado.pesos((l->>'efectivo')::numeric) || ' · Transferencias: ' || privado.pesos((l->>'transferencia')::numeric)
        || case when v_contada then '' else '. Falta contar la caja: hazlo en Ventas del local → Cuadrar caja.' end,
      '/app/ventas-local', null);
  end if;

  select token into v_token from privado.telegram_config limit 1;
  if v_token is null then return 0; end if;
  v_texto := privado.cierre_dia_texto(v_dia);
  for r in select distinct t.telegram_id from public.telegram_usuarios t join public.usuarios u on u.id = t.usuario_id
           where u.activo and 'admin' = any (u.roles) loop
    perform net.http_post(url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
                          body := jsonb_build_object('chat_id', r.telegram_id, 'text', v_texto),
                          headers := '{"Content-Type": "application/json"}'::jsonb);
    n := n + 1;
  end loop;
  return n;
end $function$;

-- ================================================================ Pedidos duplicados
-- Pedidos del mismo teléfono en las últimas 24 horas (sin cancelar). Sin datos sensibles:
-- solo lo necesario para decidir si es el mismo pedido.
create or replace function public.pedidos_parecidos(p_telefono text, p_productos bigint[] default '{}', p_excluir bigint default null)
returns jsonb language sql stable security definer set search_path to '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'estado', p.estado, 'created_at', p.created_at, 'canal', p.canal,
      'vendedora', split_part(coalesce(u.nombre, ''), ' ', 1),
      'productos', (select string_agg(i.cantidad || ' × ' || i.nombre, ', ' order by i.id) from public.pedido_items i where i.pedido_id = p.id),
      'mismos', exists (select 1 from public.pedido_items i where i.pedido_id = p.id and i.producto_id = any (coalesce(p_productos, '{}'))))
    order by p.created_at desc), '[]')
  from public.pedidos p
  left join public.usuarios u on u.id = p.vendedora_id
  where public.es_staff()
    and length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) >= 7
    and right(regexp_replace(p.cliente_telefono, '\D', '', 'g'), 10) = right(regexp_replace(p_telefono, '\D', '', 'g'), 10)
    and p.created_at > now() - interval '24 hours'
    and p.estado <> 'cancelado'
    and p.id is distinct from p_excluir
$$;
revoke execute on function public.pedidos_parecidos(text, bigint[], bigint) from public, anon;
grant execute on function public.pedidos_parecidos(text, bigint[], bigint) to authenticated;
create index if not exists pedidos_tel_creado_idx on public.pedidos (cliente_telefono, created_at desc);

-- ================================================================ Pedidos quietos
-- Más de 24 horas en el mismo estado (por alistar, alistado sin despachar o en ruta sin entregar):
-- se le avisa una vez a quien le toca y al admin un resumen.
create table if not exists privado.pedidos_quietos (
  pedido_id bigint not null,
  estado text not null,
  created_at timestamptz not null default now(),
  primary key (pedido_id, estado)
);

create or replace function privado.revisar_quietos()
returns void language plpgsql security definer set search_path to '' as $function$
declare r record; v_n int := 0; v_lista text := '';
begin
  for r in
    select p.id, p.estado::text estado, p.vendedora_id, p.mensajero_id, split_part(p.cliente_nombre, ' ', 1) cliente,
      floor(extract(epoch from now() - coalesce(case p.estado when 'por_alistar' then p.created_at when 'alistado' then p.alistado_at
                                                            when 'despachado' then p.asignado_at end, p.created_at)) / 3600)::int horas
    from public.pedidos p
    where p.estado in ('por_alistar', 'alistado', 'despachado')
      and coalesce(case p.estado when 'por_alistar' then p.created_at when 'alistado' then p.alistado_at
                                  when 'despachado' then p.asignado_at end, p.created_at) < now() - interval '24 hours'
      and not exists (select 1 from privado.pedidos_quietos q where q.pedido_id = p.id and q.estado = p.estado::text)
    order by p.id
  loop
    insert into privado.pedidos_quietos (pedido_id, estado) values (r.id, r.estado) on conflict do nothing;
    v_n := v_n + 1;
    if v_n <= 5 then v_lista := v_lista || case when v_lista = '' then '' else ', ' end || '#' || r.id; end if;

    if r.estado = 'por_alistar' then
      perform privado.avisar(privado.con_rol(array['alistador']), 'pedido_quieto',
        'Pedido #' || r.id || ' lleva ' || privado.tiempo_horas(r.horas) || ' sin alistar',
        'De ' || r.cliente || '. Revisa si falta algo para alistarlo.', '/app/pedidos?id=' || r.id, r.id);
    elsif r.estado = 'alistado' then
      perform privado.avisar(privado.con_rol(array['alistador']), 'pedido_quieto',
        'Pedido #' || r.id || ' lleva ' || privado.tiempo_horas(r.horas) || ' alistado sin salir',
        'De ' || r.cliente || '. Falta asignarle mensajero.', '/app/pedidos?id=' || r.id, r.id);
    else
      perform privado.avisar(array_remove(array[r.mensajero_id, r.vendedora_id], null), 'pedido_quieto',
        'Pedido #' || r.id || ' lleva ' || privado.tiempo_horas(r.horas) || ' en ruta',
        'De ' || r.cliente || '. Si ya se entregó, márcalo; si no, reporta la novedad.', '/app/pedidos?id=' || r.id, r.id);
    end if;
  end loop;

  if v_n > 0 then
    perform privado.avisar(privado.con_rol(array['admin']), 'pedido_quieto',
      case when v_n = 1 then '1 pedido lleva más de un día sin moverse' else v_n || ' pedidos llevan más de un día sin moverse' end,
      v_lista || case when v_n > 5 then ' y ' || (v_n - 5) || ' más' else '' end || '. Ya les avisamos a los encargados.',
      '/app/pedidos', null);
  end if;
end $function$;

create or replace function privado.tiempo_horas(h int) returns text language sql immutable set search_path to '' as $$
  select case when h < 48 then h || ' horas' else (h / 24) || ' días' end
$$;

-- Cada hora en horario de trabajo (8 a. m. a 6 p. m. en Colombia)
select cron.schedule('pedidos-quietos', '20 13-23 * * *', 'select privado.revisar_quietos()');
