export type Rol = 'admin' | 'vendedora' | 'mensajero' | 'alistador' | 'cuadres' | 'venta_local' | 'recolector';
export type EstadoPedido = 'por_alistar' | 'alistado' | 'despachado' | 'entregado' | 'cancelado';
export type TipoRecaudo = 'efectivo' | 'transferencia' | 'mixto';

export interface TarifaDomicilio {
  id: number;
  barrio: string;
  domicilio: number;
  activo: boolean;
  updated_at: string;
}

export interface Usuario {
  id: number;
  auth_id: string | null;
  nombre: string;
  email: string | null;
  telefono: string | null;
  roles: Rol[];
  activo: boolean;
  created_at: string;
  avatar_url?: string | null;
}

export interface Producto {
  id: number;
  nombre: string;
  sku: string | null;
  codigo_barras: string | null;
  precio_venta: number;
  precio_base: number;
  precio_compra: number;
  stock: number;
  controla_stock: boolean;
  imagen_url: string | null;
  activo: boolean;
  /** Texto para el catálogo (opcional) */
  descripcion?: string | null;
  colores?: ProductoColor[];
  /** Fotos adicionales del producto (aparte de la principal y de los colores) */
  imagenes?: string[] | null;
  /** Tallas disponibles (vacío = el producto no maneja tallas) */
  tallas?: string[] | null;
  /** Videos del producto (bucket público "videos") */
  videos?: string[] | null;
}

/** Variante de color de un producto, con su propia foto */
export interface ProductoColor {
  id: number;
  producto_id: number;
  nombre: string;
  hex: string | null;
  imagen_url: string | null;
  orden: number;
}

export interface Pedido {
  id: number;
  estado: EstadoPedido;
  created_at: string;
  updated_at: string;
  entregado_at: string | null;
  vendedora_id: number | null;
  mensajero_id: number | null;
  asignado_at: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  direccion: string | null;
  barrio: string | null;
  observaciones: string | null;
  valor_domicilio: number;
  total: number;
  tipo_recaudo: TipoRecaudo | null;
  valor_efectivo: number | null;
  valor_transferencia: number | null;
  /** Venta en el local: lo que se le descontó a la vendedora para la alcancía */
  aporte_alcancia?: number | null;
  evidencias: string[] | null;
  cuadre_id: number | null;
  rotulo_impreso_at: string | null;
  alistado_at?: string | null;
  canal?: 'domicilio' | 'local';
  vendedora?: { nombre: string; avatar_url?: string | null } | null;
  mensajero?: { nombre: string; avatar_url?: string | null } | null;
  pedido_items?: PedidoItem[];
}

export interface PedidoItem {
  id: number;
  pedido_id: number;
  producto_id: number | null;
  nombre: string;
  cantidad: number;
  precio_venta: number;
  precio_base: number;
  precio_compra: number;
  total: number;
  color?: string | null;
  talla?: string | null;
  producto?: { imagen_url: string | null; colores?: { nombre: string; imagen_url: string | null }[] } | null;
}

export interface Nota {
  id: number;
  created_at: string;
  autor: string | null;
  nota: string;
}

export interface Cuadre {
  id: number;
  codigo: string | null;
  mensajero_id: number | null;
  cerrado_at: string;
  /** Día (YYYY-MM-DD, hora Colombia) en que se entregaron los pedidos del cuadre */
  fecha_entrega?: string | null;
  cerrado_por_nombre: string | null;
  cantidad_pedidos: number;
  total_efectivo: number;
  total_transferencia: number;
  total_domicilios: number;
  /** pendiente = el mensajero lo entregó y falta que la oficina confirme que recibió la plata */
  estado?: 'pendiente' | 'confirmado' | 'anulado';
  confirmado_at?: string | null;
  confirmado_por_nombre?: string | null;
  mensajero?: { nombre: string } | null;
}

export const ROLES: { id: Rol; label: string }[] = [
  { id: 'admin', label: 'Admin' },
  { id: 'vendedora', label: 'Vendedora' },
  { id: 'alistador', label: 'Alistamiento' },
  { id: 'mensajero', label: 'Mensajero' },
  { id: 'cuadres', label: 'Cuadres' },
  { id: 'venta_local', label: 'Venta local' },
  { id: 'recolector', label: 'Recolector' },
];

export const ESTADOS: { id: EstadoPedido; label: string }[] = [
  { id: 'por_alistar', label: 'Por alistar' },
  { id: 'alistado', label: 'Alistado' },
  { id: 'despachado', label: 'En ruta' },
  { id: 'entregado', label: 'Entregado' },
  { id: 'cancelado', label: 'Cancelado' },
];

export function estadoLabel(e: EstadoPedido): string {
  return ESTADOS.find((x) => x.id === e)?.label ?? e;
}
