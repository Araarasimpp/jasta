-- Unificar categorías (YA APLICADO 2026-11-05)
-- Había categorías repetidas o mal escritas (Juguetes, juguetes, juguete, Juegutes, Hogar). Se pasan a
-- las oficiales y, de aquí en adelante, lo que se escriba en Categoría se lleva a la oficial que se
-- parezca (sin importar mayúsculas, tildes, plural o errores comunes).

create or replace function privado.categoria_oficial(p_cat text)
returns text language sql immutable set search_path to '' as $$
  select case
    when n = '' then null
    when n ~ '^(jug|jueg|jeug|beb)' then 'Juguetes y bebés'
    when n ~ '^organi' then 'Organización'
    when n ~ '^coci' then 'Cocina'
    when n ~ '^herra' then 'Herramientas'
    when n ~ '^tecn' then 'Tecnología'
    when n ~ '^(bell|cuida)' then 'Belleza y cuidado'
    when n ~ '^(hogar|limpi|casa)' then 'Hogar y limpieza'
    when n ~ '^(carro|moto)' then 'Carros y motos'
    when n ~ '^(depor|campi)' then 'Deporte y camping'
    when n ~ '^(ilumi|solar|luce)' then 'Iluminación y solar'
    when n ~ '^(bols|male)' then 'Bolsos y maletas'
    when n ~ '^otro' then 'Otros'
    else trim(p_cat)
  end
  from (select lower(translate(trim(coalesce(p_cat, '')), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) n) s
$$;

create or replace function privado.producto_categoria() returns trigger
language plpgsql set search_path to '' as $$
begin
  if nullif(trim(new.categoria), '') is null then new.categoria := privado.categoria_sugerida(new.nombre);
  else new.categoria := privado.categoria_oficial(new.categoria); end if;
  return new;
end $$;

alter table public.productos disable trigger act_productos;
update public.productos set categoria = privado.categoria_oficial(categoria)
 where categoria is distinct from privado.categoria_oficial(categoria) and categoria is not null;
alter table public.productos enable trigger act_productos;

-- Arreglo: la función del trigger corre como dueño (si no, al guardar un producto salía
-- "permission denied for schema privado", porque los usuarios no pueden entrar a ese esquema)
alter function privado.producto_categoria() security definer;
