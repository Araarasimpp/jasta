-- Avisos automáticos de actualizaciones
-- Cada versión publicada trae src/assets/novedades.json (lo nuevo, en palabras del equipo).
-- Cada minuto la base lee ese archivo de la app publicada y, por cada novedad que
-- no se haya avisado, le manda la notificación (campana + push) a todo el equipo o a
-- los roles que diga la novedad. Así el aviso sale solo cuando la versión ya está en línea.
--
-- Formato de novedades.json (la más nueva primero):
--   [{ "id": "2026-10-27-telefono", "fecha": "2026-10-27", "titulo": "...", "cuerpo": "...", "roles": [] }]
-- "roles" vacío o sin poner = todo el equipo.

drop function if exists public.anunciar_actualizacion(text, text, text[]);

create table if not exists privado.novedades (
  id text primary key,
  titulo text,
  avisada boolean not null default true,
  created_at timestamptz not null default now()
);
alter table privado.novedades enable row level security;

create table if not exists privado.novedades_estado (
  id boolean primary key default true check (id),
  url text not null default 'https://app.jastatechnology.com/assets/novedades.json',
  peticion bigint
);
alter table privado.novedades_estado enable row level security;
insert into privado.novedades_estado (id) values (true) on conflict do nothing;

create or replace function privado.revisar_novedades()
returns void language plpgsql security definer set search_path to '' as $function$
declare
  c privado.novedades_estado;
  r record;
  v_json jsonb;
  e jsonb;
  v_roles text[];
begin
  select * into c from privado.novedades_estado where id;
  -- 1) Procesa la respuesta de la lectura anterior
  if c.peticion is not null then
    select status_code, content into r from net._http_response where id = c.peticion;
    if found and r.status_code = 200 then
      begin v_json := r.content::jsonb; exception when others then v_json := null; end;
      if jsonb_typeof(v_json) = 'array' then
        for e in select x from jsonb_array_elements(v_json) x loop
          continue when nullif(e->>'id', '') is null or nullif(e->>'titulo', '') is null;
          continue when exists (select 1 from privado.novedades n where n.id = e->>'id');
          -- Novedades viejas (más de 7 días) se registran sin avisar
          if (e->>'fecha') ~ '^\d{4}-\d{2}-\d{2}$' and (e->>'fecha')::date < (now() at time zone 'America/Bogota')::date - 7 then
            insert into privado.novedades (id, titulo, avisada) values (e->>'id', e->>'titulo', false);
            continue;
          end if;
          insert into privado.novedades (id, titulo) values (e->>'id', e->>'titulo');
          v_roles := array(select jsonb_array_elements_text(case when jsonb_typeof(e->'roles') = 'array' then e->'roles' else '[]'::jsonb end));
          perform privado.avisar(
            case when cardinality(v_roles) = 0 then (select coalesce(array_agg(id), '{}') from public.usuarios where activo)
                 else privado.con_rol(v_roles) end,
            'actualizacion', left(e->>'titulo', 120), left(coalesce(e->>'cuerpo', ''), 500),
            '/app/actualizaciones?n=' || (e->>'id'), null);  -- abre la explicación completa
        end loop;
      end if;
    end if;
  end if;
  -- 2) Pide el archivo otra vez (la respuesta se procesa en la próxima vuelta)
  update privado.novedades_estado
     set peticion = net.http_get(url || '?v=' || extract(epoch from now())::bigint)
   where id;
end $function$;
revoke execute on function privado.revisar_novedades() from public, anon, authenticated;

select cron.schedule('novedades-app', '* * * * *', 'select privado.revisar_novedades()');
