/**
 * Guion y tiempos de cada escena (en fotogramas, 30 fps).
 *
 * Cada escena dura lo que su frase de la voz más un respiro (ver VOZ abajo).
 */
export interface Escena {
  id: string;
  desde: number;
  dura: number;
  voz: string;
}


export const ESCENAS: Escena[] = [
  { id: 'problema', desde: 0, dura: 150, voz: '¿Todavía escribes cada pedido a mano?' },
  { id: 'desgaste', desde: 150, dura: 156, voz: 'Copiar el mensaje, calcular el domicilio, volver a escribir todo… otra vez.' },
  { id: 'solucion', desde: 306, dura: 180, voz: 'Ahora tienes tu propio catálogo. Un enlace, con todos tus productos.' },
  {
    id: 'compartir', desde: 486, dura: 360,
    voz: 'Entra a Pedidos de la tienda y toca Compartir. Mándalo a tus estados, a Instagram o a tus grupos. Es tu enlace, con tu nombre.',
  },
  {
    id: 'cliente', desde: 846, dura: 510,
    voz: 'Tu cliente abre el catálogo, ve las fotos y los precios, y elige. Lo agotado ya aparece marcado. Escribe su dirección, el domicilio se calcula solo… y hace el pedido, sin escribirte.',
  },
  {
    id: 'confirmar', desde: 1356, dura: 450,
    voz: 'A ti te llega el aviso al instante. Ves todo el pedido y, si el cliente ha tenido problemas, la app te lo dice. Le escribes, confirmas, y pasa directo a alistamiento.',
  },
  { id: 'confianza', desde: 1806, dura: 240, voz: 'Los precios son los sugeridos y nadie los cambia. Lo agotado no se puede pedir. Y tu comisión es la de siempre.' },
  { id: 'impacto', desde: 2046, dura: 195, voz: 'Casi cuatrocientos productos. Un solo enlace. Cero pedidos escritos a mano.' },
  { id: 'cierre', desde: 2241, dura: 300, voz: 'Jasta. Vende mientras tu cliente elige. Busca tu enlace en Más, Pedidos de la tienda, y compártelo hoy.' },
];

export const TOTAL = 2541;
/** Fotogramas que se solapan dos escenas al pasar de una a otra */
export const CRUCE = 14;

/**
 * La voz (public/voz.mp3, ElevenLabs · Mariana) cortada en frases: de qué segundo a qué segundo
 * del audio va cada una, y en qué segundo de su escena empieza. Las pausas se midieron con
 * silencedetect; las animaciones de cada escena están puestas sobre estas frases.
 */
export const VOZ: { escena: string; de: number; a: number; en: number }[] = [
  { escena: 'problema', de: 0.25, a: 2.25, en: 0.6 },
  { escena: 'desgaste', de: 3.16, a: 8.14, en: 0.1 },
  { escena: 'solucion', de: 9.31, a: 13.59, en: 0.4 },
  { escena: 'compartir', de: 14.67, a: 23.45, en: 0.5 },
  { escena: 'cliente', de: 24.55, a: 31.35, en: 0.8 },
  { escena: 'cliente', de: 31.8, a: 37.47, en: 8.4 },
  { escena: 'confirmar', de: 38.55, a: 45.8, en: 0.8 },
  { escena: 'confirmar', de: 46.27, a: 49.83, en: 8.9 },
  { escena: 'confianza', de: 50.87, a: 57.86, en: 0.3 },
  { escena: 'impacto', de: 58.68, a: 63.93, en: 0.3 },
  { escena: 'cierre', de: 64.94, a: 71.8, en: 0.3 },
];
