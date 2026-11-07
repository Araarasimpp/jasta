-- PENDIENTE: córrelo en el SQL Editor de Supabase (o dile a Claude "dale").
-- Gastos personales: solo los administradores los ven, registran y quitan.
-- Van en su propia tabla: no se mezclan con los gastos del negocio ni con la utilidad real.
create table if not exists public.gastos_personales (
  id bigint generated always as identity primary key,
  fecha date not null,
  categoria text not null,
  descripcion text not null,
  valor numeric not null check (valor > 0),
  metodo text not null default 'efectivo',
  comprobantes text[] not null default '{}',
  creado_por bigint references public.usuarios(id) on delete set null,
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
create index if not exists gastos_personales_fecha_idx on public.gastos_personales (fecha desc);
-- Sin políticas: nadie la lee directo, solo por las funciones de abajo (que exigen admin)
alter table public.gastos_personales enable row level security;
revoke all on public.gastos_personales from anon, authenticated;

create or replace function public.registrar_gasto_personal(p_fecha date, p_categoria text, p_descripcion text, p_valor numeric, p_metodo text, p_comprobantes text[])
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo los administradores'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Escribe el valor del gasto'; end if;
  if nullif(trim(coalesce(p_descripcion, '')), '') is null then raise exception 'Escribe en qué se gastó'; end if;
  insert into public.gastos_personales (fecha, categoria, descripcion, valor, metodo, comprobantes, creado_por, creado_por_nombre)
  values (coalesce(p_fecha, (now() at time zone 'America/Bogota')::date), coalesce(nullif(p_categoria, ''), 'otros'), left(trim(p_descripcion), 300), p_valor,
          coalesce(p_metodo, 'efectivo'), privado.comprobantes_validos(p_comprobantes), public.mi_usuario_id(), public.mi_nombre())
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.quitar_gasto_personal(p_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.tiene_rol('admin') then raise exception 'Solo los administradores'; end if;
  delete from public.gastos_personales where id = p_id;
  if not found then raise exception 'El gasto ya no existe'; end if;
end $$;

create or replace function public.gastos_personales_resumen(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo los administradores'; end if;
  with g as (select * from public.gastos_personales where fecha between p_desde and p_hasta)
  select jsonb_build_object(
    'total', coalesce((select sum(valor) from g), 0),
    'n', (select count(*) from g),
    'por_categoria', coalesce((select jsonb_agg(x order by x.total desc) from (select categoria, sum(valor) total, count(*) n from g group by 1) x), '[]'),
    'por_metodo', coalesce((select jsonb_agg(x order by x.total desc) from (select metodo, sum(valor) total from g group by 1) x), '[]'),
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'fecha', fecha, 'categoria', categoria, 'descripcion', descripcion, 'valor', valor,
              'metodo', metodo, 'comprobantes', comprobantes, 'creado_por_nombre', creado_por_nombre) order by fecha desc, id desc) from g), '[]')
  ) into r;
  return r;
end $$;

revoke all on function public.registrar_gasto_personal(date, text, text, numeric, text, text[]) from public, anon;
revoke all on function public.quitar_gasto_personal(bigint) from public, anon;
revoke all on function public.gastos_personales_resumen(date, date) from public, anon;
grant execute on function public.registrar_gasto_personal(date, text, text, numeric, text, text[]) to authenticated;
grant execute on function public.quitar_gasto_personal(bigint) to authenticated;
grant execute on function public.gastos_personales_resumen(date, date) to authenticated;
