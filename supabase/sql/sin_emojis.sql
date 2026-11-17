-- YA APLICADO (2026-11-17). Queda aquí como registro.
-- La app no usa emojis: se quitaron de los avisos al celular y de los mensajes de Telegram
-- que arman las funciones de la base (los textos quedan iguales, sin el emoji del principio).
-- telegram_despachar decía "ok" si el texto empezaba con el emoji de visto bueno; ahora, si empieza con "#".
do $$ declare r record; d text; n text; begin
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname in ('public','privado') and p.prokind = 'f'
      and pg_get_functiondef(p.oid) ~ '[\U0001F000-\U0001FAFF☀-☄☇-✒✔-➿⌀-⏿]' loop
    d := pg_get_functiondef(r.f);
    n := replace(d, 'v_txt like ''✅%''', 'v_txt like ''#%''');
    n := regexp_replace(n, '[\U0001F000-\U0001FAFF☀-☄☇-✒✔-➿⌀-⏿]️?\s?', '', 'g');
    if n <> d then execute n; end if;
  end loop;
end $$;
