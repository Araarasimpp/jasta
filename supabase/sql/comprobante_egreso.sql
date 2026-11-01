-- Comprobante de egreso de las comisiones (para la DIAN) (PENDIENTE DE APLICAR)
-- Cada pago a una vendedora sale como comprobante de egreso numerado (CE-000123) con los datos
-- del negocio (NIT), de quien recibe (cédula), el detalle de las comisiones, el total, la forma
-- de pago y el soporte. Se puede agregar el soporte después si el pago se registró sin él.

alter table public.usuarios add column if not exists documento text;
alter table public.configuracion add column if not exists nit text,
  add column if not exists direccion text;

-- Cédula de una persona del equipo (admin)
create or replace function public.guardar_documento(p_usuario bigint, p_documento text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  update public.usuarios set documento = nullif(left(regexp_replace(trim(coalesce(p_documento, '')), '\s+', ' ', 'g'), 30), '') where id = p_usuario;
end $function$;

-- NIT y dirección del negocio (admin)
create or replace function public.guardar_datos_fiscales(p_nit text, p_direccion text)
returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  update public.configuracion set nit = nullif(left(trim(coalesce(p_nit, '')), 30), ''),
    direccion = nullif(left(trim(coalesce(p_direccion, '')), 160), ''), updated_at = now();
end $function$;

-- Todo lo del comprobante de un pago: el admin o la vendedora a la que se le pagó
create or replace function public.comprobante_liquidacion(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare l public.liquidaciones; v_yo bigint := public.mi_usuario_id();
begin
  select * into l from public.liquidaciones where id = p_id;
  if not found then raise exception 'Ese pago no existe'; end if;
  if not (public.tiene_rol('admin') or l.vendedora_id = v_yo) then raise exception 'Sin permiso'; end if;
  return jsonb_build_object(
    'id', l.id, 'desde', l.desde, 'hasta', l.hasta, 'pedidos', l.cantidad_pedidos, 'total', l.total, 'metodo', l.metodo,
    'comprobantes', l.comprobantes, 'nota', l.nota, 'pagado_at', l.pagado_at, 'pagado_por', l.pagado_por_nombre, 'anulada', l.anulada,
    'vendedora', (select jsonb_build_object('nombre', u.nombre, 'documento', u.documento, 'telefono', u.telefono, 'email', u.email)
                  from public.usuarios u where u.id = l.vendedora_id),
    'negocio', (select jsonb_build_object('nombre', c.nombre_negocio, 'nit', c.nit, 'direccion', c.direccion, 'telefonos', c.telefonos)
                from public.configuracion c limit 1),
    'detalle', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'dia', x.dia, 'cliente', x.cliente_nombre, 'total', x.total, 'comision', x.comision) order by x.dia, x.id), '[]')
                from public.liquidacion_pedidos(l.vendedora_id, l.id) x));
end $function$;

-- Agregar el soporte a un pago ya registrado (admin)
create or replace function public.agregar_soporte_liquidacion(p_id bigint, p_comprobantes text[])
returns void language plpgsql security definer set search_path to '' as $function$
declare v_ev text[];
begin
  if not public.tiene_rol('admin') then raise exception 'Sin permiso'; end if;
  v_ev := privado.comprobantes_validos(p_comprobantes);
  if cardinality(v_ev) = 0 then raise exception 'Sube al menos una foto del soporte'; end if;
  update public.liquidaciones set comprobantes = coalesce(comprobantes, '{}') || v_ev where id = p_id;
  if not found then raise exception 'Ese pago no existe'; end if;
end $function$;

revoke execute on function public.guardar_documento(bigint, text), public.guardar_datos_fiscales(text, text),
  public.comprobante_liquidacion(bigint), public.agregar_soporte_liquidacion(bigint, text[]) from public, anon;
grant execute on function public.guardar_documento(bigint, text), public.guardar_datos_fiscales(text, text),
  public.comprobante_liquidacion(bigint), public.agregar_soporte_liquidacion(bigint, text[]) to authenticated;
