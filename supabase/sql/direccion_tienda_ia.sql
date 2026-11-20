-- ============================================================================
--  Jasta · Las direcciones de la tienda en línea se ordenan solas con IA
--  YA APLICADO en Supabase (proyecto Jasta); se guarda como registro.
--
--  Cuando entra un pedido por la tienda (pedidos_web), un disparador llama con
--  pg_net a la función ia-tienda, que ordena la dirección con Gemini. La que
--  escribió el cliente queda en direccion_original y se ve en "Pedidos de la
--  tienda". La llamada lleva la clave 'ia_interno' del Vault (la creó la base
--  con gen_random_bytes; nadie la ve). Si algo falla, el pedido entra igual.
-- ============================================================================

alter table public.pedidos_web add column if not exists direccion_original text;

-- (una sola vez) select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'ia_interno', 'Clave para que la base llame a la función ia-tienda');

create or replace function privado.ordenar_direccion_web()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare v_clave text;
begin
  if length(trim(coalesce(new.direccion, ''))) > 4 then
    begin
      select decrypted_secret into v_clave from vault.decrypted_secrets where name = 'ia_interno' limit 1;
      if v_clave is not null then
        perform net.http_post(
          url := 'https://ktksdoedeazkvohewqzx.supabase.co/functions/v1/ia-tienda',
          body := jsonb_build_object('id', new.id),
          headers := jsonb_build_object('content-type', 'application/json', 'x-ia-interno', v_clave),
          timeout_milliseconds := 30000);
      end if;
    exception when others then
      -- Si no se puede llamar a la IA, el pedido entra igual con la dirección como la escribió el cliente
      null;
    end;
  end if;
  return new;
end $function$;

create or replace trigger pedidos_web_ordenar_direccion
after insert on public.pedidos_web
for each row execute function privado.ordenar_direccion_web();

-- pedidos_web_lista ahora también devuelve 'direccion_original' (se agregó con replace sobre la definición)
