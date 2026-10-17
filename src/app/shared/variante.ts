import { PedidoItem } from './modelos';

/** "Negro · Talla M" (vacío si la línea no lleva color ni talla) */
export function variante(i: Pick<PedidoItem, 'color' | 'talla'>): string {
  return [i.color, i.talla ? 'Talla ' + i.talla : null].filter(Boolean).join(' · ');
}

/** "Camiseta (Negro · Talla M)" o solo el nombre */
export function nombreConVariante(i: Pick<PedidoItem, 'nombre' | 'color' | 'talla'>): string {
  const v = variante(i);
  return v ? `${i.nombre} (${v})` : i.nombre;
}

/** La foto del color pedido si la tiene; si no, la del producto */
export function fotoDeItem(i: Pick<PedidoItem, 'color' | 'producto'>): string | null {
  const delColor = i.color ? i.producto?.colores?.find((c) => c.nombre === i.color)?.imagen_url : null;
  return delColor || i.producto?.imagen_url || null;
}

/** Lo que se pide de cada producto en las consultas de pedidos (foto y fotos de colores) */
export const PRODUCTO_DE_ITEM = 'producto:productos(imagen_url, colores:producto_colores(nombre, imagen_url))';
