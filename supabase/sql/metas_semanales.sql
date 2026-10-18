-- Metas semanales en el ranking y pesos solo para el admin. Ya aplicado en Supabase; respaldo.
alter table public.metas add column if not exists meta_ventas_semana integer check (meta_ventas_semana is null or meta_ventas_semana >= 0),
  add column if not exists meta_entregas_semana integer check (meta_entregas_semana is null or meta_entregas_semana >= 0);

-- p_periodo = 'semana' usa la meta semanal; lo demás, la del mes. Quien no es admin
-- recibe solo la cantidad de ventas/entregas (ventas = null).
create or replace function public.ranking(p_desde date, p_hasta date, p_periodo text)
 returns table(usuario_id bigint, nombre text, avatar_url text, tipo text, cantidad integer, ventas numeric, meta integer, puesto integer, avance integer)
 language sql stable security definer set search_path to ''
as $function$
  with yo as (select public.tiene_rol('admin') as ve_pesos),
  ent as (
    select * from public.pedidos
    where estado = 'entregado'
      and coalesce(entregado_at, created_at) >= (p_desde::text || ' 00:00 America/Bogota')::timestamptz
      and coalesce(entregado_at, created_at) < ((p_hasta + 1)::text || ' 00:00 America/Bogota')::timestamptz
  ),
  v as (select vendedora_id id, count(*)::int n, sum(total - valor_domicilio) pesos from ent group by 1),
  m as (select mensajero_id id, count(*)::int n from ent where canal = 'domicilio' and mensajero_id is not null group by 1),
  filas as (
    select u.id, u.nombre, u.avatar_url, 'vendedora'::text tipo, coalesce(v.n,0) n, coalesce(v.pesos,0) pesos,
      case when p_periodo = 'semana' then mt.meta_ventas_semana else mt.meta_ventas end meta
    from public.usuarios u left join v on v.id = u.id left join public.metas mt on mt.usuario_id = u.id
    where (u.activo and 'vendedora' = any(u.roles)) or v.id is not null
    union all
    select u.id, u.nombre, u.avatar_url, 'mensajero', coalesce(m.n,0), 0,
      case when p_periodo = 'semana' then mt.meta_entregas_semana else mt.meta_entregas end
    from public.usuarios u left join m on m.id = u.id left join public.metas mt on mt.usuario_id = u.id
    where (u.activo and 'mensajero' = any(u.roles)) or m.id is not null
  )
  select f.id, f.nombre, f.avatar_url, f.tipo, f.n, case when yo.ve_pesos then f.pesos end, f.meta,
    (row_number() over (partition by f.tipo order by f.n desc, f.pesos desc, f.nombre))::int,
    case when f.meta > 0 then least(100, round(f.n::numeric / f.meta * 100))::int end
  from filas f, yo
  where public.es_staff()
$function$;
revoke execute on function public.ranking(date, date, text) from public, anon;
grant execute on function public.ranking(date, date, text) to authenticated;
