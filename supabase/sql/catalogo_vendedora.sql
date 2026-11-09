-- Catálogo personalizado de cada vendedora: su foto, una frase y hasta 8 productos destacados
-- que salen arriba en su enlace de la tienda (/tienda/<nombre>-<id>). Sin foto propia del catálogo,
-- se usa la de su perfil (usuarios.avatar_url). YA APLICADO.
create table if not exists public.vendedoras_tienda (
  usuario_id bigint primary key references public.usuarios(id),
  foto_url text,
  bio text check (char_length(bio) <= 160),
  destacados bigint[] not null default '{}' check (cardinality(destacados) <= 8),
  updated_at timestamptz not null default now()
);
alter table public.vendedoras_tienda enable row level security;
-- Sin políticas: solo se usa por las funciones de abajo.

create or replace function public.mi_tienda_perfil()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_yo bigint := public.mi_usuario_id(); r public.vendedoras_tienda;
begin
  if v_yo is null or not public.tiene_rol('vendedora') then raise exception 'Sin permiso'; end if;
  select * into r from public.vendedoras_tienda where usuario_id = v_yo;
  return jsonb_build_object('foto_url', r.foto_url, 'bio', r.bio, 'destacados', coalesce(to_jsonb(r.destacados), '[]'));
end $$;

create or replace function public.mi_tienda_guardar(p_foto_url text, p_bio text, p_destacados bigint[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_yo bigint := public.mi_usuario_id(); v_dest bigint[];
begin
  if v_yo is null or not public.tiene_rol('vendedora') then raise exception 'Sin permiso'; end if;
  if p_foto_url is not null and p_foto_url !~ '^https://ktksdoedeazkvohewqzx\.supabase\.co/storage/v1/object/public/avatars/' then
    raise exception 'Foto no válida';
  end if;
  -- Solo productos activos, sin repetir, en el orden elegido y máximo 8
  select coalesce(array_agg(id order by o), '{}') into v_dest from (
    select d.id, min(d.o) o from unnest(coalesce(p_destacados, '{}')) with ordinality d(id, o)
    where exists (select 1 from public.productos p where p.id = d.id and p.activo) group by d.id order by 2 limit 8) x;
  insert into public.vendedoras_tienda (usuario_id, foto_url, bio, destacados, updated_at)
  values (v_yo, p_foto_url, nullif(left(trim(coalesce(p_bio, '')), 160), ''), v_dest, now())
  on conflict (usuario_id) do update set foto_url = excluded.foto_url, bio = excluded.bio, destacados = excluded.destacados, updated_at = now();
  return public.mi_tienda_perfil();
end $$;

-- Las dos revisan dentro que quien llama sea vendedora.

-- public.tienda(): el objeto "vendedora" ahora trae foto_url, bio y destacados
do $$
declare d text := pg_get_functiondef('public.tienda(bigint)'::regprocedure);
  viejo text := $v$jsonb_build_object('id', v_vend.id, 'nombre', v_vend.nombre, 'telefono', v_vend.telefono)$v$;
  nuevo text := $v$jsonb_build_object('id', v_vend.id, 'nombre', v_vend.nombre, 'telefono', v_vend.telefono,
                   'foto_url', coalesce((select vt.foto_url from public.vendedoras_tienda vt where vt.usuario_id = v_vid), v_vend.avatar_url),
                   'bio', (select vt.bio from public.vendedoras_tienda vt where vt.usuario_id = v_vid),
                   'destacados', coalesce((select to_jsonb(vt.destacados) from public.vendedoras_tienda vt where vt.usuario_id = v_vid), '[]'))$v$;
begin
  if position('vendedoras_tienda' in d) > 0 then return; end if;
  if position(viejo in d) = 0 then raise exception 'No encontré el objeto vendedora en tienda()'; end if;
  execute replace(d, viejo, nuevo);
end $$;
