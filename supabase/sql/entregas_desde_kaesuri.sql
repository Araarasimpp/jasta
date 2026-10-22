-- ============================================================================
--  Entregas desde la app de Variedades JYB (Kaesuri) · YA APLICADO en Supabase
--
--  El mensajero que también reparte para Variedades JYB ve sus pedidos en ruta de
--  Jasta en la app de Kaesuri, los entrega desde allá y entrega su cuadre de Jasta
--  (los cuadres siguen separados por negocio). Es el espejo de jasta-puente en Kaesuri.
--
--  Lo usa la función kaesuri-puente (supabase/functions/kaesuri-puente), que valida
--  la sesión de Kaesuri y llama estas funciones con la llave de servicio. La misma
--  persona se reconoce por el correo con el que entra a las dos apps.
--
--  Las funciones solo las puede llamar service_role. Dentro de cada una se pone al
--  mensajero como auth.uid(), así entregar_pedido y cerrar_cuadre de Jasta hacen sus
--  propias validaciones y todo queda a su nombre (notas, cuadres, avisos).
--
--  Aviso al instante: cuando cambia un pedido o cuadre del mensajero se manda un aviso
--  sin datos al canal 'kaesuri-entregas:<auth_id>'; la app de Kaesuri vuelve a pedir el resumen.
-- ============================================================================

-- Mensajero activo con ese correo (y con cuenta para entrar); lo deja como usuario de la transacción
create or replace function public.kaesuri_mensajero(p_email text)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_id bigint; v_auth uuid;
begin
  select id, auth_id into v_id, v_auth from public.usuarios
   where lower(email) = lower(trim(p_email)) and activo and auth_id is not null and 'mensajero' = any (roles);
  if v_id is not null then
    perform set_config('request.jwt.claim.sub', v_auth::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  end if;
  return v_id;
end;
$function$;

create or replace function public.kaesuri_resumen(p_email text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_men bigint := public.kaesuri_mensajero(p_email);
begin
  if v_men is null then
    return jsonb_build_object('vinculado', false);
  end if;
  return jsonb_build_object(
    'vinculado', true,
    'canal', 'kaesuri-entregas:' || auth.uid(),
    'en_ruta', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'cliente_nombre', p.cliente_nombre, 'cliente_telefono', p.cliente_telefono,
               'direccion', p.direccion, 'barrio', p.barrio, 'valor_domicilio', p.valor_domicilio, 'total', p.total,
               'observaciones', p.observaciones, 'asignado_at', p.asignado_at, 'vendedora', v.nombre,
               'items', coalesce((
                 select jsonb_agg(jsonb_build_object('nombre', i.nombre, 'cantidad', i.cantidad, 'color', i.color,
                                                     'talla', i.talla, 'total', i.total) order by i.id)
                   from public.pedido_items i where i.pedido_id = p.id), '[]'::jsonb))
             order by p.asignado_at nulls first, p.id)
        from public.pedidos p left join public.usuarios v on v.id = p.vendedora_id
       where p.mensajero_id = v_men and p.estado = 'despachado'), '[]'::jsonb),
    'por_cuadrar', (
      select jsonb_build_object('pedidos', count(*), 'efectivo', coalesce(sum(valor_efectivo), 0),
                                'transferencia', coalesce(sum(valor_transferencia), 0),
                                'domicilios', coalesce(sum(valor_domicilio), 0), 'desde', min(entregado_at))
        from public.pedidos
       where mensajero_id = v_men and estado = 'entregado' and cuadre_id is null),
    'por_confirmar', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'cerrado_at', c.cerrado_at, 'cantidad_pedidos', c.cantidad_pedidos,
                                          'total_a_entregar', c.total_efectivo - c.total_domicilios) order by c.cerrado_at)
        from public.cuadres c
       where c.mensajero_id = v_men and c.estado = 'pendiente'), '[]'::jsonb));
end;
$function$;

-- Usa entregar_pedido de Jasta, solo para pedidos en ruta de ese mensajero
create or replace function public.kaesuri_entregar(p_email text, p_pedido bigint, p_tipo text, p_efectivo numeric,
                                                   p_transferencia numeric, p_evidencias text[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_men bigint := public.kaesuri_mensajero(p_email);
begin
  if v_men is null then
    raise exception 'Tu correo de Variedades JYB no está como mensajero en Jasta';
  end if;
  if not exists (select 1 from public.pedidos where id = p_pedido and mensajero_id = v_men and estado = 'despachado') then
    raise exception 'Este pedido ya no está en ruta contigo';
  end if;
  perform public.entregar_pedido(p_pedido, p_tipo, p_efectivo, p_transferencia, p_evidencias);
end;
$function$;

-- El mensajero entrega su cuadre de Jasta (queda por confirmar hasta que la oficina reciba la plata)
create or replace function public.kaesuri_cerrar_cuadre(p_email text)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_men bigint := public.kaesuri_mensajero(p_email);
begin
  if v_men is null then
    raise exception 'Tu correo de Variedades JYB no está como mensajero en Jasta';
  end if;
  return public.cerrar_cuadre(v_men);
end;
$function$;

-- Lo que entregó en un rango de fechas (historial)
create or replace function public.kaesuri_entregadas(p_email text, p_desde timestamptz default null, p_hasta timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_men bigint := public.kaesuri_mensajero(p_email);
begin
  if v_men is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id, 'cliente_nombre', p.cliente_nombre, 'barrio', p.barrio, 'total', p.total,
             'valor_domicilio', p.valor_domicilio, 'tipo_recaudo', p.tipo_recaudo,
             'efectivo', coalesce(p.valor_efectivo, 0), 'transferencia', coalesce(p.valor_transferencia, 0),
             'entregado_at', p.entregado_at,
             'cuadre', case when p.cuadre_id is null then 'por_cuadrar'
                            when c.estado = 'pendiente' then 'por_confirmar' else 'cuadrado' end)
           order by p.entregado_at desc)
      from public.pedidos p left join public.cuadres c on c.id = p.cuadre_id
     where p.mensajero_id = v_men and p.estado = 'entregado'
       and (p_desde is null or p.entregado_at >= p_desde)
       and (p_hasta is null or p.entregado_at <= p_hasta)), '[]'::jsonb);
end;
$function$;

-- Aviso al instante a la app de Kaesuri
create or replace function public.kaesuri_avisar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_ids bigint[]; v_auth uuid;
begin
  v_ids := array[case when tg_op <> 'INSERT' then old.mensajero_id end,
                 case when tg_op <> 'DELETE' then new.mensajero_id end];
  for i in 1 .. 2 loop
    if v_ids[i] is not null and (i = 1 or v_ids[i] is distinct from v_ids[1]) then
      select auth_id into v_auth from public.usuarios where id = v_ids[i];
      if v_auth is not null then
        perform realtime.send(jsonb_build_object('cambio', true), 'cambio', 'kaesuri-entregas:' || v_auth, false);
      end if;
    end if;
  end loop;
  return null;
exception when others then
  return null; -- el aviso nunca debe impedir guardar
end;
$function$;

create trigger trg_kaesuri_avisar after insert or update or delete on public.pedidos
  for each row execute function public.kaesuri_avisar();
create trigger trg_kaesuri_avisar after insert or update or delete on public.cuadres
  for each row execute function public.kaesuri_avisar();

revoke all on function public.kaesuri_mensajero(text) from public, anon, authenticated;
revoke all on function public.kaesuri_resumen(text) from public, anon, authenticated;
revoke all on function public.kaesuri_entregar(text, bigint, text, numeric, numeric, text[]) from public, anon, authenticated;
revoke all on function public.kaesuri_cerrar_cuadre(text) from public, anon, authenticated;
revoke all on function public.kaesuri_entregadas(text, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.kaesuri_avisar() from public, anon, authenticated;
grant execute on function public.kaesuri_resumen(text) to service_role;
grant execute on function public.kaesuri_entregar(text, bigint, text, numeric, numeric, text[]) to service_role;
grant execute on function public.kaesuri_cerrar_cuadre(text) to service_role;
grant execute on function public.kaesuri_entregadas(text, timestamptz, timestamptz) to service_role;

-- Carpeta del mensajero en el bucket de comprobantes (su auth_id), donde van las fotos que llegan de Kaesuri
create or replace function public.kaesuri_carpeta(p_email text)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth_id from public.usuarios
   where lower(email) = lower(trim(p_email)) and activo and auth_id is not null and 'mensajero' = any (roles);
$function$;
revoke all on function public.kaesuri_carpeta(text) from public, anon, authenticated;
grant execute on function public.kaesuri_carpeta(text) to service_role;
