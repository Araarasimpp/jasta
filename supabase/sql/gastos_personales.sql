-- YA APLICADO en Supabase (2026-11-07).
-- Gastos personales: solo los administradores los ven, registran y quitan. Sin fotos: solo el registro.
-- Van en su propia tabla: no se mezclan con los gastos del negocio ni con la utilidad real.
create table if not exists public.gastos_personales (
  id bigint generated always as identity primary key,
  fecha date not null,
  categoria text not null,
  descripcion text not null,
  valor numeric not null check (valor > 0),
  metodo text not null default 'efectivo',
  creado_por bigint references public.usuarios(id) on delete set null,
  creado_por_nombre text,
  created_at timestamptz not null default now()
);
-- Por si quedó la primera versión (con fotos)
alter table public.gastos_personales drop column if exists comprobantes;
drop function if exists public.registrar_gasto_personal(date, text, text, numeric, text, text[]);
create index if not exists gastos_personales_fecha_idx on public.gastos_personales (fecha desc);
-- Sin políticas: nadie la lee directo, solo por las funciones de abajo (que exigen admin)
alter table public.gastos_personales enable row level security;
revoke all on public.gastos_personales from anon, authenticated;

create or replace function public.registrar_gasto_personal(p_fecha date, p_categoria text, p_descripcion text, p_valor numeric, p_metodo text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo los administradores'; end if;
  if coalesce(p_valor, 0) <= 0 then raise exception 'Escribe el valor del gasto'; end if;
  if nullif(trim(coalesce(p_descripcion, '')), '') is null then raise exception 'Escribe en qué se gastó'; end if;
  insert into public.gastos_personales (fecha, categoria, descripcion, valor, metodo, creado_por, creado_por_nombre)
  values (coalesce(p_fecha, (now() at time zone 'America/Bogota')::date), coalesce(nullif(p_categoria, ''), 'otros'), left(trim(p_descripcion), 300), p_valor,
          coalesce(p_metodo, 'efectivo'), public.mi_usuario_id(), public.mi_nombre())
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

-- Resumen del periodo: total, por categoría y medio de pago, la serie para la gráfica de líneas
-- (por día, o por mes si el periodo pasa de 3 meses) y el periodo anterior del mismo largo para comparar.
create or replace function public.gastos_personales_resumen(p_desde date, p_hasta date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r jsonb;
  v_ini date;
  v_dias int;
  v_mes boolean;
  a_desde date;
  a_hasta date;
begin
  if not public.tiene_rol('admin') then raise exception 'Solo los administradores'; end if;
  -- Si el periodo empieza antes del primer gasto, la gráfica arranca en el primer gasto
  v_ini := greatest(p_desde, coalesce((select min(fecha) from public.gastos_personales), p_hasta));
  if v_ini > p_hasta then v_ini := p_hasta; end if;
  v_dias := p_hasta - p_desde + 1;
  v_mes := (p_hasta - v_ini) > 92;
  a_hasta := p_desde - 1;
  a_desde := p_desde - v_dias;
  with g as (select * from public.gastos_personales where fecha between p_desde and p_hasta),
  a as (select * from public.gastos_personales where v_dias <= 400 and fecha between a_desde and a_hasta),
  serie as (
    select d::date k from generate_series(
      case when v_mes then date_trunc('month', v_ini)::date else v_ini end, p_hasta,
      case when v_mes then interval '1 month' else interval '1 day' end) d
  )
  select jsonb_build_object(
    'total', coalesce((select sum(valor) from g), 0),
    'n', (select count(*) from g),
    'dias', v_dias,
    'por_categoria', coalesce((select jsonb_agg(x order by x.total desc) from (select categoria, sum(valor) total, count(*) n from g group by 1) x), '[]'),
    'por_metodo', coalesce((select jsonb_agg(x order by x.total desc) from (select metodo, sum(valor) total from g group by 1) x), '[]'),
    'agrupado', case when v_mes then 'mes' else 'dia' end,
    'serie', coalesce((select jsonb_agg(jsonb_build_object('fecha', s.k, 'total',
        coalesce((select sum(valor) from g where (case when v_mes then date_trunc('month', g.fecha)::date else g.fecha end) = s.k), 0)) order by s.k) from serie s), '[]'),
    'anterior', case when v_dias <= 400 then (select coalesce(sum(valor), 0) from a) end,
    'serie_anterior', case when not v_mes and v_dias <= 400 then
        (select jsonb_agg(coalesce((select sum(valor) from a where a.fecha = a_desde + (v_ini - p_desde) + i), 0) order by i)
         from generate_series(0, p_hasta - v_ini) i) end,
    'lista', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'fecha', fecha, 'categoria', categoria, 'descripcion', descripcion, 'valor', valor,
              'metodo', metodo, 'creado_por_nombre', creado_por_nombre) order by fecha desc, id desc) from g), '[]')
  ) into r;
  return r;
end $$;

revoke all on function public.registrar_gasto_personal(date, text, text, numeric, text) from public, anon;
revoke all on function public.quitar_gasto_personal(bigint) from public, anon;
revoke all on function public.gastos_personales_resumen(date, date) from public, anon;
grant execute on function public.registrar_gasto_personal(date, text, text, numeric, text) to authenticated;
grant execute on function public.quitar_gasto_personal(bigint) to authenticated;
grant execute on function public.gastos_personales_resumen(date, date) to authenticated;
