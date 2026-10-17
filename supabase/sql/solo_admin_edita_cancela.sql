-- Editar y cancelar pedidos: solo el admin. La vendedora ya no puede editar ni
-- cancelar sus pedidos (solo los ve y conversa con el mensajero).
-- Asignar o cambiar mensajero ya era solo de admin y alistamiento.
-- Ya aplicado en Supabase; se guarda aquí como respaldo.
do $$
declare s text;
  a1 text := 'if not v_admin and not (p.vendedora_id = public.mi_usuario_id() and p.estado = ''por_alistar'') then';
  a2 text := 'if not v_admin and not (p.vendedora_id = v_yo and p.estado = ''por_alistar'') then raise exception ''Solo el admin puede cancelar este pedido''; end if;';
begin
  s := pg_get_functiondef('public.editar_pedido(bigint,text,text,text,text,text,numeric,jsonb)'::regprocedure);
  s := replace(s, a1, 'if not v_admin then');
  s := replace(s, 'raise exception ''Solo puedes editar tus pedidos que aún no se han alistado'';', 'raise exception ''Solo el admin puede editar pedidos'';');
  execute s;
  s := pg_get_functiondef('public.cambiar_estado(bigint,public.estado_pedido,bigint)'::regprocedure);
  s := replace(s, a2, 'if not v_admin then raise exception ''Solo el admin puede cancelar pedidos''; end if;');
  execute s;
end $$;
