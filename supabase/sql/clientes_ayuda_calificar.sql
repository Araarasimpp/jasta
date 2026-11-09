-- YA APLICADO en Supabase (2026-11-09).
-- Mis compras: calificar la compra (entrega y productos, con las funciones de siempre calificar_entrega /
-- calificar_productos usando el código de seguimiento) y pedir ayuda con un pedido.

create table if not exists public.clientes_ayuda (
  id bigint generated always as identity primary key,
  cliente_id bigint not null references public.clientes_cuentas(id),
  pedido_id bigint references public.pedidos(id),
  pedido_web_id bigint references public.pedidos_web(id),
  motivo text not null,
  mensaje text,
  estado text not null default 'abierta',
  created_at timestamptz not null default now()
);
create index if not exists clientes_ayuda_cliente_idx on public.clientes_ayuda (cliente_id);
alter table public.clientes_ayuda enable row level security;

-- cliente_compras() ahora devuelve además, por compra:
--   seguimiento (código para calificar), calif (estrellas de la entrega o null), items[].mi_resena (estrellas o null),
--   whatsapp (de la vendedora del pedido, o el primero de configuracion.telefonos) y ayudas (lo que ha reportado).
-- (Ver la definición vigente con: select pg_get_functiondef('public.cliente_compras()'::regprocedure);)

-- Pedir ayuda: se guarda y les llega un aviso (tipo ayuda_cliente) al admin y a la vendedora del pedido.
-- Máximo 5 por hora por cliente. Solo pedidos de su cuenta (o de antes con su mismo correo verificado).
create or replace function public.cliente_pedir_ayuda(p_codigo text, p_ruta text, p_motivo text, p_mensaje text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.clientes_cuentas; v_ped bigint; v_web bigint; v_vend bigint; v_txt text := nullif(left(trim(coalesce(p_mensaje, '')), 600), '');
  v_mot text := left(trim(coalesce(p_motivo, '')), 60); v_n bigint; v_ver boolean;
begin
  select * into c from public.clientes_cuentas where auth_id = auth.uid();
  if c.id is null then raise exception 'Inicia sesión con tu cuenta'; end if;
  if v_mot = '' then raise exception 'Elige qué pasó'; end if;
  if v_mot = 'Otro' and v_txt is null then raise exception 'Cuéntanos qué pasó'; end if;
  if p_ruta = 'pago' then
    select pw.id, pw.pedido_id, pw.vendedora_id into v_web, v_ped, v_vend from public.pedidos_web pw where pw.codigo::text = p_codigo and pw.cliente_cuenta_id = c.id;
  else
    v_ver := coalesce((select u.email_confirmed_at is not null from auth.users u where u.id = c.auth_id), false);
    select p.id, p.vendedora_id into v_ped, v_vend from public.pedidos p
     where p.seguimiento::text = p_codigo and (p.cliente_cuenta_id = c.id or (v_ver and lower(p.cliente_email) = lower(c.email)));
  end if;
  if v_ped is null and v_web is null then raise exception 'Ese pedido no es de tu cuenta'; end if;
  if (select count(*) from public.clientes_ayuda where cliente_id = c.id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Ya nos escribiste varias veces. Te vamos a contactar pronto.';
  end if;
  insert into public.clientes_ayuda (cliente_id, pedido_id, pedido_web_id, motivo, mensaje) values (c.id, v_ped, v_web, v_mot, v_txt);
  v_n := coalesce(v_ped, v_web);
  perform privado.avisar(
    case when v_vend is null then privado.con_rol(array['admin']) else array[v_vend] || privado.con_rol(array['admin']) end,
    'ayuda_cliente', '🆘 Ayuda con ' || case when v_ped is not null then 'el pedido #' else 'el pedido web #' end || v_n || ': ' || v_mot,
    split_part(trim(coalesce(nullif(c.nombre, ''), 'El cliente')), ' ', 1) || coalesce(' (' || c.telefono || ')', '') || coalesce(': "' || v_txt || '"', ' pide ayuda. Llámalo o escríbele.'),
    case when v_ped is not null then '/app/pedidos?id=' || v_ped else '/app/pedidos-web' end, v_ped);
  return jsonb_build_object('ok', true);
end $$;
