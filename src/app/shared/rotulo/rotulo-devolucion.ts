import { SupabaseClient } from '@supabase/supabase-js';
import { pesos } from '../formato';
import { RotuloEspecial, cargarDatosNegocio, documentoRotulos, imprimirHtml, rotuloHtml } from './rotulo';

/** Lo necesario para el rótulo de una devolución, un cambio o una garantía */
export interface DevolucionParaRotulo {
  tipo: 'devolucion' | 'cambio' | 'garantia';
  pedido_id: number;
  cliente: string;
  cliente_telefono: string | null;
  direccion: string | null;
  barrio: string | null;
  fecha: string;
  items: { nombre: string; cantidad: number }[] | null;
  /** Cambio por otro igual */
  reemplazo?: boolean | null;
  /** Cambio por otro producto */
  nuevo_nombre?: string | null;
  nuevo_cantidad?: number | null;
  diferencia?: number | null;
  diferencia_metodo?: string | null;
  /** Garantía: por qué se dejó y en qué va */
  nota?: string | null;
  garantia_estado?: string | null;
  /** Número del envío (el pedido que lleva el mensajero): es el que va en el QR para Despachar */
  numero?: number | null;
}

const linea = (nombre: string, cantidad: number) => `${nombre}${cantidad > 1 ? ' x' + cantidad : ''}`;

/** Qué dice el rótulo: qué recoger, qué entregar y cuánto cobrar */
export function especialDe(d: DevolucionParaRotulo): RotuloEspecial {
  const items = (d.items ?? []).map((i) => linea(i.nombre, i.cantidad));
  if (d.tipo === 'devolucion') {
    return { tipo: 'devolucion', cobro: 'NO COBRAR', recoge: items, entrega: [], nota: 'Recoger el producto que devuelve' };
  }
  if (d.tipo === 'garantia') {
    // Ya arreglada: se le lleva; si no, se recoge para mandarla al arreglo
    const llevar = ['lista', 'en_camino', 'entregada'].includes(d.garantia_estado ?? '');
    return {
      tipo: 'garantia',
      cobro: 'GARANTÍA · NO COBRAR',
      recoge: llevar ? [] : items,
      entrega: llevar ? items : [],
      nota: llevar ? 'Entregar la garantía arreglada' : d.nota ? 'Garantía: ' + d.nota : 'Recoger para garantía',
    };
  }
  // Cambio
  const dif = Number(d.diferencia) || 0;
  const porOtro = !!d.nuevo_nombre;
  const entrega = porOtro ? [linea(d.nuevo_nombre!, Number(d.nuevo_cantidad) || 1)] : d.reemplazo === false ? [] : items;
  const contraEntrega = dif > 0 && d.diferencia_metodo === 'contra_entrega';
  return {
    tipo: 'cambio',
    cobro: contraEntrega ? 'COBRAR ' + pesos(dif) : 'NO COBRAR',
    recoge: items,
    entrega,
    nota: contraEntrega
      ? 'Deducible por cambio a un producto de más valor'
      : dif > 0
        ? 'Deducible ya pagado'
        : 'Cambio sin costo para el cliente',
  };
}

/** Imprime el rótulo (100 × 100 mm) en la impresora de rótulos, igual que el de un pedido */
export async function imprimirRotuloDevolucion(client: SupabaseClient, d: DevolucionParaRotulo): Promise<void> {
  const negocio = await cargarDatosNegocio(client);
  const html = rotuloHtml(
    {
      numero: d.numero ?? d.pedido_id,
      cliente_nombre: d.cliente,
      cliente_telefono: d.cliente_telefono,
      direccion: d.direccion ?? '',
      barrio: d.barrio,
      observaciones: null,
      total: 0,
      created_at: d.fecha,
      productos: [],
      especial: especialDe(d),
    },
    negocio
  );
  const titulo = { devolucion: 'Devolución', cambio: 'Cambio', garantia: 'Garantía' }[d.tipo];
  imprimirHtml(documentoRotulos([html], `${titulo} #${d.numero ?? d.pedido_id}`));
}

/** El rótulo de un envío ya creado (pedido con "servicio"): lo que se guardó al crearlo */
export function especialDeEnvio(servicio: string, total: number, detalle: { recoge?: string[]; entrega?: string[]; nota?: string | null } | null): RotuloEspecial {
  const tipo = (['cambio', 'garantia', 'devolucion'].includes(servicio) ? servicio : 'cambio') as RotuloEspecial['tipo'];
  return {
    tipo,
    cobro: total > 0 ? 'COBRAR ' + pesos(total) : tipo === 'garantia' ? 'GARANTÍA · NO COBRAR' : 'NO COBRAR',
    recoge: detalle?.recoge ?? [],
    entrega: detalle?.entrega ?? [],
    nota: detalle?.nota ?? null,
  };
}

/** Lo que el mensajero le cobra al cliente: solo el deducible de un cambio cobrado contra entrega */
export function cobroDe(d: DevolucionParaRotulo): number {
  const dif = Number(d.diferencia) || 0;
  return d.tipo === 'cambio' && dif > 0 && d.diferencia_metodo === 'contra_entrega' ? dif : 0;
}

/**
 * Crea el envío (un pedido ya alistado que pasa por Despachar, Mis entregas y el cuadre del
 * mensajero) y, si se pide, imprime su rótulo con el número del envío en el QR.
 */
export async function crearEnvioDevolucion(
  client: SupabaseClient,
  devolucionId: number,
  d: DevolucionParaRotulo,
  domicilio: number,
  imprimir: boolean,
  cobrar = cobroDe(d)
): Promise<number> {
  const esp = especialDe(d);
  const { data, error } = await client.rpc('crear_envio_devolucion', {
    p_devolucion: devolucionId,
    p_domicilio: domicilio,
    p_cobrar: cobrar,
    p_detalle: { tipo: d.tipo, recoge: esp.recoge, entrega: esp.entrega, nota: esp.nota },
  });
  if (error) throw error;
  const numero = Number(data);
  if (imprimir) await imprimirRotuloDevolucion(client, { ...d, numero, ...(cobrar !== cobroDe(d) ? { diferencia: cobrar, diferencia_metodo: cobrar ? 'contra_entrega' : null } : {}) });
  return numero;
}
