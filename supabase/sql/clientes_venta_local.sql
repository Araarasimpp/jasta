-- Página Clientes también para el rol Venta local. Ya aplicado en Supabase; respaldo.
do $$ declare def text := pg_get_functiondef('public.clientes(text,integer,integer)'::regprocedure);
begin
  execute replace(def, $q$and estado = 'entregado' and public.tiene_rol('admin')$q$, $q$and estado = 'entregado' and (public.tiene_rol('admin') or public.tiene_rol('venta_local'))$q$);
end $$;

-- Lo que compró un cliente (pedidos entregados de ese teléfono, a domicilio y en el local)
create or replace function public.compras_cliente(p_telefono text)
returns table(id bigint, created_at timestamptz, canal text, total numeric, vendedora text, productos text[])
language sql stable security definer set search_path to ''
as $$
  select p.id, p.created_at, p.canal, p.total, u.nombre,
    coalesce((select array_agg(i.nombre order by i.id) from public.pedido_items i where i.pedido_id = p.id), '{}')
  from public.pedidos p left join public.usuarios u on u.id = p.vendedora_id
  where (public.tiene_rol('admin') or public.tiene_rol('venta_local'))
    and p.estado = 'entregado'
    and length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) >= 7
    and regexp_replace(p.cliente_telefono, '\D', '', 'g') = regexp_replace(p_telefono, '\D', '', 'g')
  order by p.created_at desc
  limit 100
$$;
revoke execute on function public.compras_cliente(text) from public, anon;
grant execute on function public.compras_cliente(text) to authenticated;
