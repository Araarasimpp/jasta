-- Garantías: sin tocar inventario, con el problema escrito y el seguimiento del técnico (YA APLICADO 2026-11-06)
-- * Una garantía ya no suma ni resta inventario (ni "vuelve al inventario" ni "se entregó otro").
-- * Se escribe por qué se deja en garantía (va en la nota, obligatoria).
-- * Después se le pone el técnico, la fecha y las observaciones, y se marca como resuelta.

alter table public.devoluciones
  add column if not exists tecnico text,
  add column if not exists tecnico_fecha date,
  add column if not exists tecnico_obs text,
  add column if not exists resuelta_at timestamptz;

do $$
declare v text := replace(pg_get_functiondef('public.registrar_devolucion(bigint,jsonb,text,text,text,boolean,numeric,text,boolean,text,text[])'::regprocedure), chr(13), '');
begin
  if position('garantía ya no toca' in v) = 0 then
    v := replace(v, '  if p_tipo not in (''devolucion'', ''cambio'', ''garantia'') then raise exception ''Tipo inválido''; end if;',
      '  if p_tipo not in (''devolucion'', ''cambio'', ''garantia'') then raise exception ''Tipo inválido''; end if;
  -- La garantía ya no toca el inventario: solo se escribe por qué se deja
  if p_tipo = ''garantia'' and nullif(trim(coalesce(p_nota, '''')), '''') is null then raise exception ''Escribe por qué se deja en garantía''; end if;');
    v := replace(v, 'p_estado_producto, p_tipo <> ''devolucion'' and coalesce(p_reemplazo, false),',
      'p_estado_producto, p_tipo = ''cambio'' and coalesce(p_reemplazo, false),');
    v := replace(v, '    if i.producto_id is not null then', '    if i.producto_id is not null and p_tipo <> ''garantia'' then');
    v := replace(v, '    || '' · '' || privado.motivo_devolucion(p_motivo)
    || case when p_estado_producto = ''vuelve_stock'' then '' · vuelve al inventario'' else '' · producto dañado'' end',
      '    || case when p_tipo = ''garantia'' then '' · '' || trim(p_nota) else '' · '' || privado.motivo_devolucion(p_motivo)
    || case when p_estado_producto = ''vuelve_stock'' then '' · vuelve al inventario'' else '' · producto dañado'' end end');
    v := replace(v, '|| case when p_tipo <> ''devolucion'' and coalesce(p_reemplazo, false) then '' · se entregó otro''',
      '|| case when p_tipo = ''cambio'' and coalesce(p_reemplazo, false) then '' · se entregó otro''');
    if position('garantía ya no toca' in v) = 0 or position('p_tipo <> ''garantia'' then' in v) = 0
       or position('then '' · '' || trim(p_nota)' in v) = 0 or position('p_tipo = ''cambio'' and coalesce(p_reemplazo, false),' in v) = 0 then
      raise exception 'No se pudo cambiar registrar_devolucion';
    end if;
    execute v;
  end if;

  v := replace(pg_get_functiondef('public.devoluciones_lista(date,date)'::regprocedure), chr(13), '');
  if position('tecnico' in v) = 0 then
    v := replace(v, '''nota'', dv.nota, ''fotos'', dv.fotos,',
      '''nota'', dv.nota, ''fotos'', dv.fotos, ''tecnico'', dv.tecnico, ''tecnico_fecha'', dv.tecnico_fecha, ''tecnico_obs'', dv.tecnico_obs,
        ''resuelta'', dv.resuelta_at is not null,');
    if position('''tecnico''' in v) = 0 then raise exception 'No se pudo cambiar devoluciones_lista'; end if;
    execute v;
  end if;
end $$;

-- Seguimiento de la garantía: técnico, fecha, observaciones y si ya quedó resuelta
create or replace function public.garantia_tecnico(p_id bigint, p_tecnico text, p_fecha date, p_obs text, p_resuelta boolean)
returns void language plpgsql security definer set search_path to '' as $function$
declare d public.devoluciones;
begin
  if not privado.puede_devoluciones() then raise exception 'Sin permiso'; end if;
  select * into d from public.devoluciones where id = p_id for update;
  if not found or d.tipo <> 'garantia' then raise exception 'Esa garantía no existe'; end if;
  if privado.limpio(p_tecnico, 80) is null then raise exception 'Escribe el nombre del técnico'; end if;
  if p_fecha is null then raise exception 'Elige la fecha'; end if;
  update public.devoluciones set tecnico = privado.limpio(p_tecnico, 80), tecnico_fecha = p_fecha, tecnico_obs = privado.limpio(p_obs, 600),
    resuelta_at = case when coalesce(p_resuelta, false) then coalesce(resuelta_at, now()) end
   where id = d.id;
  perform public.nota(d.pedido_id, 'Garantía · técnico ' || privado.limpio(p_tecnico, 80) || ' (' || to_char(p_fecha, 'DD/MM/YYYY') || ')'
    || coalesce(' · ' || privado.limpio(p_obs, 600), '') || case when coalesce(p_resuelta, false) then ' · resuelta' else '' end);
end $function$;
revoke execute on function public.garantia_tecnico(bigint, text, date, text, boolean) from public, anon;
grant execute on function public.garantia_tecnico(bigint, text, date, text, boolean) to authenticated;
