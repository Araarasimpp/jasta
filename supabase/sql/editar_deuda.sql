-- YA APLICADO (2026-11-04)
-- Editar una deuda: proveedor, concepto, total (no menos de lo abonado), fecha y vencimiento.
create or replace function public.editar_deuda(p_deuda bigint, p_proveedor text, p_concepto text, p_total numeric, p_fecha date, p_vence date)
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
  if p_fecha > (now() at time zone 'America/Bogota')::date then raise exception 'La fecha no puede ser después de hoy'; end if;
  select coalesce(sum(valor), 0) into v_abonado from public.deuda_abonos where deuda_id = d.id and not anulado;
  if v_total < v_abonado then raise exception 'Ya le has abonado %: el total no puede ser menor', privado.pesos(v_abonado); end if;
  update public.deudas set proveedor = v_prov, concepto = privado.limpio(p_concepto, 300), total = v_total, fecha = p_fecha, vence = p_vence,
    estado = case when v_abonado >= v_total then 'pagada' else 'abierta' end
   where id = d.id;
end $function$;
revoke execute on function public.editar_deuda(bigint, text, text, numeric, date, date) from public, anon;
grant execute on function public.editar_deuda(bigint, text, text, numeric, date, date) to authenticated;
