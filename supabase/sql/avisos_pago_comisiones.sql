-- YA APLICADO (2026-11-03)
-- El aviso "Te pagaron tus comisiones" abre ese pago con su comprobante (/app/comisiones?pago=ID),
-- y a la vendedora le llega un aviso cuando el admin sube el soporte después del pago.

do $$
declare v text;
begin
  select pg_get_functiondef('public.pagar_liquidacion(bigint,date,text,text[],text,date)'::regprocedure) into v;
  if position('''/app/comisiones'', null)' in v) > 0 then
    v := replace(v, '''/app/comisiones'', null)', '''/app/comisiones?pago='' || v_id, null)');
    execute v;
  end if;
end $$;

create or replace function public.agregar_soporte_liquidacion(p_id bigint, p_comprobantes text[])
returns void language plpgsql security definer set search_path to '' as $$
declare v_ev text[]; l public.liquidaciones;
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  v_ev := privado.comprobantes_validos(p_comprobantes);
  if cardinality(v_ev) = 0 then raise exception 'Sube al menos una foto del soporte'; end if;
  update public.liquidaciones set comprobantes = coalesce(comprobantes, '{}') || v_ev where id = p_id returning * into l;
  if not found then raise exception 'Ese pago no existe'; end if;
  if not l.anulada then
    perform privado.avisar(array[l.vendedora_id], 'liquidacion', 'Ya está el comprobante de tu pago',
      privado.pesos(l.total) || ' · toca para verlo', '/app/comisiones?pago=' || l.id, null);
  end if;
end $$;
revoke all on function public.agregar_soporte_liquidacion(bigint, text[]) from public, anon;
grant execute on function public.agregar_soporte_liquidacion(bigint, text[]) to authenticated;
