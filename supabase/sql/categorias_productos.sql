-- Categorías de productos (YA APLICADO)
-- Cada producto tiene una categoría para filtrar el catálogo público. Al crear un producto sin
-- categoría se le sugiere una por el nombre; el admin la puede cambiar en el formulario.

alter table public.productos add column if not exists categoria text;

create or replace function privado.categoria_sugerida(p_nombre text)
returns text language sql immutable set search_path to '' as $$
  select case
    when n ~ '\m(armario|zapatero|perchero)' then 'Organización'
    when n ~ '\m(infantil|nina|nino|ninos|bebe|muneca|muneco|munecas|casita|castillo|mansion|peluche|patin|patines|patineta|triciclo|bicicleta|caminador|control remoto|carro loco|robot|go kart|hidrogel|orbis|set de arte|lapiz 3d|consola|stich|capibara|alas de|juguete|pelotas|trampolin|saltarin|juego de cocina|recreativo|panalera|telescopio)' then 'Juguetes y bebés'
    when n ~ '\m(carro|moto|parabrisas|vehiculos?|intercomunicador|impermeable|impermabl|botas|poncho)\M' then 'Carros y motos'
    when n ~ '\m(organizador|organizadora|tendedero|estante|estanteria|gabinete|esquinero|tubo soporte|elevador de muebles|sujecion|soporte para escoba|soporte dispensador)' then 'Organización'
    when n ~ '\m(freidora|olla|licuadora|estufa|batidora|picadora|molino|sellador|selladora|crispetera|hervidor|lonchera|cubiertos|utensilios|condimentero|dispensador de granos|embutidor|extractor|cortadora|recipientes|termo|termometro|donas|parrilla|parrila|espumador|escurridor)' then 'Cocina'
    when n ~ '\m(plancha|secador|rizador|rizadora|peine|depilador|derma|ultrasonido|callos|masajeador|masajeadora|gimnasia|irrigador|dental|oidos|almohadilla termica|colicos|sordera|cepillo con uv|piojos|re2[0-9]{3})' and n !~ 'plancha a vapor|plancha viajera|zapatos|ropa' then 'Belleza y cuidado'
    when n ~ '\m(reflector|solar|bombillo|lampara|cinta led|linterna|luces)' and n !~ '\mcamara' then 'Iluminación y solar'
    when n ~ '\m(camara|audifono|airpods|tv stick|proyector|microfono|radios|impresora|reloj|detector|registradora|celular|alcoholimetro|soporte (de pedestal )?para tv)' then 'Tecnología'
    when n ~ '\m(taladro|pulidora|destornillador|pistola de pintar|remachadora|clavos|mezclador|reparacion|gato hidraulico|manguera|polichadora|guadana|motosierra|soplador|sopladora|hidrolavadora|compresor|arrancador|iniciador|cargador|bascula|gramera|maquina de coser|teclop)' then 'Herramientas'
    when n ~ '\m(bandas|abdominal|flexiones|ejercicio|camping|reclinable|plegable|inflable|mascotas?|perro|toldillo|baston)' then 'Deporte y camping'
    when n ~ '\m(aspiradora|limpiador|limpieza|trapero|escoba|secadora|ventilador|aire acondicionado|plancha|cortina|funda|tapete|almohada|cojin|electrodomestico|mesa|carrito|secador de zapatos)' then 'Hogar y limpieza'
    when n ~ '\m(maletin|maleta|canguro|morral)' then 'Bolsos y maletas'
    else 'Otros'
  end
  from (select lower(translate(coalesce(p_nombre, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')) n) s
$$;

create or replace function privado.producto_categoria() returns trigger
language plpgsql set search_path to '' as $$
begin
  if nullif(trim(new.categoria), '') is null then new.categoria := privado.categoria_sugerida(new.nombre);
  else new.categoria := trim(new.categoria); end if;
  return new;
end $$;

drop trigger if exists producto_categoria on public.productos;
create trigger producto_categoria before insert or update of categoria on public.productos
  for each row execute function privado.producto_categoria();

-- Relleno inicial (sin llenar el registro de actividad con cientos de cambios)
alter table public.productos disable trigger act_productos;
update public.productos set categoria = privado.categoria_sugerida(nombre) where categoria is null;
alter table public.productos enable trigger act_productos;

-- El catálogo público manda la categoría de cada producto (para filtrar)
create or replace function public.tienda(p_vendedora bigint default null)
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare v_vend public.usuarios; v_vid bigint;
begin
  v_vid := privado.vendedora_tienda(p_vendedora);
  if p_vendedora is not null and v_vid is null then return null; end if;
  select * into v_vend from public.usuarios where id = v_vid;
  return jsonb_build_object(
    'negocio', (select nombre_negocio from public.configuracion limit 1),
    'telefonos', (select telefonos from public.configuracion limit 1),
    'vendedora', case when v_vid is null then null
                 else jsonb_build_object('id', v_vend.id, 'nombre', v_vend.nombre, 'telefono', v_vend.telefono) end,
    'barrios', (select coalesce(jsonb_agg(jsonb_build_object('barrio', barrio, 'domicilio', domicilio) order by barrio), '[]')
                from public.tarifas_domicilio where activo),
    'productos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'nombre', p.nombre, 'precio', p.precio_venta, 'categoria', coalesce(p.categoria, 'Otros'),
        'imagen_url', p.imagen_url, 'tallas', coalesce(p.tallas, '{}'),
        'colores', (select coalesce(jsonb_agg(jsonb_build_object('nombre', c.nombre, 'hex', c.hex, 'imagen_url', c.imagen_url) order by c.orden, c.id), '[]')
                    from public.producto_colores c where c.producto_id = p.id),
        'agotado', p.controla_stock and p.stock <= 0,
        'disponibles', case when p.controla_stock then greatest(p.stock, 0) end)
      order by (p.controla_stock and p.stock <= 0), coalesce(v.n, 0) desc, p.nombre), '[]')
      from public.productos p
      left join (select i.producto_id, sum(i.cantidad) n from public.pedido_items i join public.pedidos x on x.id = i.pedido_id
                 where x.created_at > now() - interval '30 days' and x.estado <> 'cancelado' group by 1) v on v.producto_id = p.id
      where p.activo));
end $function$;
