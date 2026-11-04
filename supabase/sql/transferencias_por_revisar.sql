-- Transferencias por revisar (YA APLICADO 2026-11-04)
-- Cada pago presencial con transferencia (entrega a domicilio o venta del local) queda "por revisar"
-- hasta que el admin confirma en el banco que sí llegó. Aviso inmediato a los admins y recordatorio
-- cada 30 minutos (7 a. m. a 10 p. m.) mientras quede alguna sin revisar. Los pagos en línea (Wompi)
-- no entran: esos los confirma Wompi.

alter table public.pedidos
  add column if not exists transferencia_estado text check (transferencia_estado in ('por_revisar', 'llego', 'no_llego')),
  add column if not exists transferencia_revisada_at timestamptz,
  add column if not exists transferencia_revisada_por text,
  add column if not exists transferencia_nota text;
create index if not exists pedidos_transferencia_por_revisar_idx on public.pedidos (entregado_at) where transferencia_estado = 'por_revisar';

-- Al quedar entregado con transferencia: queda por revisar y se avisa a los admins
create or replace function privado.marcar_transferencia()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare v_valor numeric; v_quien text;
begin
  if new.estado <> 'entregado' or coalesce(new.valor_transferencia, 0) <= 0 or new.pagado_linea is not null
     or new.transferencia_estado is not null then
    return null;
  end if;
  update public.pedidos set transferencia_estado = 'por_revisar' where id = new.id;
  v_valor := new.valor_transferencia + coalesce(new.propina, 0);
  select nombre into v_quien from public.usuarios where id = case when new.canal = 'local' then new.vendedora_id else new.mensajero_id end;
  perform privado.avisar(privado.con_rol(array['admin']), 'transferencia',
    '💸 Revisa una transferencia de ' || privado.pesos(v_valor),
    case when new.canal = 'local' then 'Venta del local' else 'Pedido #' || new.id end || ' · ' || coalesce(new.cliente_nombre, 'Cliente')
      || coalesce(' · registró ' || split_part(v_quien, ' ', 1), '') || '. Mira en el banco si llegó y confírmalo.',
    '/app/transferencias', new.id);
  return null;
end $function$;

drop trigger if exists pedidos_transferencia_por_revisar on public.pedidos;
create trigger pedidos_transferencia_por_revisar
  after insert or update of estado, valor_transferencia on public.pedidos
  for each row execute function privado.marcar_transferencia();

-- Si la venta se anula o el pedido deja de estar entregado, ya no hay nada que revisar
create or replace function privado.desmarcar_transferencia()
returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.transferencia_estado = 'por_revisar' and (new.estado <> 'entregado' or coalesce(new.valor_transferencia, 0) <= 0) then
    new.transferencia_estado := null;
  end if;
  return new;
end $function$;
drop trigger if exists pedidos_transferencia_desmarcar on public.pedidos;
create trigger pedidos_transferencia_desmarcar
  before update of estado, valor_transferencia on public.pedidos
  for each row execute function privado.desmarcar_transferencia();

-- Lista para la página Transferencias
create or replace function public.transferencias_lista(p_estado text default 'por_revisar')
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  return coalesce((select jsonb_agg(x order by (x->>'estado') = 'por_revisar' desc,
      case when x->>'estado' = 'por_revisar' then x->>'entregado_at' end asc, x->>'revisada_at' desc) from (
    select jsonb_build_object(
      'id', p.id, 'estado', p.transferencia_estado, 'canal', p.canal, 'cliente', p.cliente_nombre, 'telefono', p.cliente_telefono,
      'total', p.total, 'transferencia', p.valor_transferencia, 'propina', coalesce(p.propina, 0),
      'esperado', p.valor_transferencia + coalesce(p.propina, 0), 'tipo', p.tipo_recaudo,
      'entregado_at', p.entregado_at, 'evidencias', coalesce(p.evidencias, '{}'),
      'mensajero', m.nombre, 'vendedora', v.nombre,
      'revisada_at', p.transferencia_revisada_at, 'revisada_por', p.transferencia_revisada_por, 'nota', p.transferencia_nota) x
    from public.pedidos p
    left join public.usuarios m on m.id = p.mensajero_id
    left join public.usuarios v on v.id = p.vendedora_id
    where case coalesce(p_estado, 'por_revisar')
            when 'por_revisar' then p.transferencia_estado = 'por_revisar'
            when 'no_llego' then p.transferencia_estado = 'no_llego'
            else p.transferencia_estado in ('llego', 'no_llego') and p.transferencia_revisada_at > now() - interval '15 days' end
    limit 300) s), '[]');
end $function$;

-- Cuántas faltan (para el aviso rojo de arriba)
create or replace function public.transferencias_pendientes()
returns jsonb language sql stable security definer set search_path to '' as $$
  select case when public.tiene_rol('admin') then
    (select jsonb_build_object('n', count(*), 'valor', coalesce(sum(valor_transferencia + coalesce(propina, 0)), 0), 'desde', min(entregado_at))
     from public.pedidos where transferencia_estado = 'por_revisar')
  else jsonb_build_object('n', 0, 'valor', 0) end
$$;

-- El admin confirma si llegó o no
create or replace function public.revisar_transferencia(p_pedido bigint, p_llego boolean, p_nota text default null)
returns void language plpgsql security definer set search_path to '' as $function$
declare p public.pedidos; v_nota text := nullif(left(trim(coalesce(p_nota, '')), 300), ''); v_dest bigint[];
begin
  if not public.tiene_rol('admin') then raise exception 'Solo el admin confirma transferencias'; end if;
  select * into p from public.pedidos where id = p_pedido for update;
  if not found then raise exception 'Ese pedido no existe'; end if;
  if p.transferencia_estado is null then raise exception 'Este pedido no tiene transferencia por revisar'; end if;
  if not p_llego and v_nota is null then raise exception 'Escribe qué pasó (ej: no aparece en el banco, llegó menos)'; end if;
  update public.pedidos set transferencia_estado = case when p_llego then 'llego' else 'no_llego' end,
    transferencia_revisada_at = now(), transferencia_revisada_por = public.mi_nombre(), transferencia_nota = v_nota
   where id = p.id;
  perform public.nota(p.id, case when p_llego then 'Transferencia confirmada en el banco' else 'La transferencia NO llegó: ' || v_nota end);
  if not p_llego then
    v_dest := array_remove(array[case when p.canal = 'local' then p.vendedora_id else p.mensajero_id end], null)
              || privado.con_rol(array['admin']);
    perform privado.avisar(v_dest, 'transferencia', '⚠️ No llegó la transferencia de ' || privado.pesos(p.valor_transferencia + coalesce(p.propina, 0)),
      case when p.canal = 'local' then 'Venta del local' else 'Pedido #' || p.id end || ' · ' || coalesce(p.cliente_nombre, 'Cliente') || ': ' || v_nota,
      case when p.canal = 'local' then '/app/ventas-local' else '/app/pedidos?id=' || p.id end, p.id);
  end if;
end $function$;

revoke execute on function public.transferencias_lista(text), public.transferencias_pendientes(), public.revisar_transferencia(bigint, boolean, text) from public, anon;
grant execute on function public.transferencias_lista(text), public.transferencias_pendientes(), public.revisar_transferencia(bigint, boolean, text) to authenticated;

-- Recordatorio insistente: cada 30 minutos mientras quede alguna sin revisar (7 a. m. a 10 p. m.).
-- Borra el recordatorio anterior sin leer para que no se amontonen, pero el celular vuelve a sonar.
create or replace function privado.recordar_transferencias()
returns void language plpgsql security definer set search_path to '' as $function$
declare v_n int; v_valor numeric; v_desde timestamptz; v_hora int := extract(hour from now() at time zone 'America/Bogota'); v_horas int;
begin
  if v_hora < 7 or v_hora >= 22 then return; end if;
  select count(*), coalesce(sum(valor_transferencia + coalesce(propina, 0)), 0), min(entregado_at) into v_n, v_valor, v_desde
    from public.pedidos where transferencia_estado = 'por_revisar';
  if v_n = 0 then return; end if;
  v_horas := floor(extract(epoch from now() - v_desde) / 3600);
  delete from public.notificaciones where tipo = 'transferencia_pendiente' and not leida;
  perform privado.avisar(privado.con_rol(array['admin']), 'transferencia_pendiente',
    case when v_horas >= 3 then '🚨🚨 ' else '🚨 ' end || v_n || case when v_n = 1 then ' transferencia sin revisar' else ' transferencias sin revisar' end
      || ' · ' || privado.pesos(v_valor),
    case when v_horas >= 1 then 'La más vieja lleva ' || v_horas || (case when v_horas = 1 then ' hora' else ' horas' end) || ' esperando. ' else '' end
      || 'Entra al banco, revísalas y confírmalas. Este aviso se repite cada 30 minutos hasta que las revises.',
    '/app/transferencias', null);
end $function$;
select cron.schedule('recordar-transferencias', '*/30 * * * *', 'select privado.recordar_transferencias()');
