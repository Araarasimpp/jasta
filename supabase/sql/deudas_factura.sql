-- YA APLICADO (2026-11-09). Queda aquí como registro.
-- Foto de la factura en las deudas: las deudas sin compra de inventario guardan sus
-- propias fotos; las que vienen de una compra usan las de la compra.

alter table public.deudas add column if not exists comprobantes text[] not null default '{}';

create or replace function public.deuda_factura(p_deuda bigint, p_comprobantes text[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare d public.deudas; v text[] := coalesce(p_comprobantes, '{}');
begin
  perform privado.solo_admin();
  select * into d from public.deudas where id = p_deuda for update;
  if not found then raise exception 'Esa deuda no existe'; end if;
  if coalesce(array_length(v, 1), 0) > 8 then raise exception 'Máximo 8 fotos por factura'; end if;
  if exists (select 1 from unnest(v) r where r is null or r not like 'sb://comprobantes/%' or length(r) > 300) then raise exception 'Foto no válida'; end if;
  if d.compra_id is not null then
    update public.compras set comprobantes = v where id = d.compra_id;
    update public.deudas set comprobantes = '{}' where id = d.id;
  else
    update public.deudas set comprobantes = v where id = d.id;
  end if;
end $function$;

-- deudas_lista: además devuelve 'comprobantes' (los de la compra + los de la deuda).
-- Se cambió en vivo con pg_get_functiondef + replace; la definición vigente está en la base.

-- Además se recuperaron las fotos de las deudas 6 a 14, que se habían subido pero no
-- quedaron enlazadas (se emparejó cada deuda con el archivo subido segundos antes).
