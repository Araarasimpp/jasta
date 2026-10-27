/**
 * Guion y tiempos de cada escena (en fotogramas, 30 fps).
 *
 * La voz todavía no está grabada: estos tiempos son provisionales, calculados para
 * leer cada texto con calma. Cuando llegue el audio de ElevenLabs (public/voz.mp3),
 * se ajustan `desde` y `palabras` a sus marcas de tiempo y todo se mueve solo.
 */
export interface Escena {
  id: string;
  desde: number;
  dura: number;
  voz: string;
}

const s = (seg: number) => Math.round(seg * 30);

export const ESCENAS: Escena[] = [
  { id: 'problema', desde: s(0), dura: s(5), voz: '¿Todavía escribes cada pedido a mano?' },
  { id: 'desgaste', desde: s(5), dura: s(5), voz: 'Copiar el mensaje, calcular el domicilio, volver a escribir todo… otra vez.' },
  { id: 'solucion', desde: s(10), dura: s(6), voz: 'Ahora tienes tu propio catálogo. Un enlace, con todos tus productos.' },
  {
    id: 'compartir',
    desde: s(16),
    dura: s(16),
    voz: 'Entra a Pedidos de la tienda y toca Compartir. Mándalo a tus estados, a Instagram o a tus grupos. Es tu enlace, con tu nombre.',
  },
  {
    id: 'cliente',
    desde: s(32),
    dura: s(18),
    voz: 'Tu cliente abre el catálogo, ve las fotos y los precios, y elige. Lo agotado ya aparece marcado. Escribe su dirección, el domicilio se calcula solo… y hace el pedido, sin escribirte.',
  },
  {
    id: 'confirmar',
    desde: s(50),
    dura: s(16),
    voz: 'A ti te llega el aviso al instante. Ves todo el pedido y, si el cliente ha tenido problemas, la app te lo dice. Le escribes, confirmas, y pasa directo a alistamiento.',
  },
  { id: 'confianza', desde: s(66), dura: s(8), voz: 'Los precios son los sugeridos y nadie los cambia. Lo agotado no se puede pedir. Y tu comisión es la de siempre.' },
  { id: 'impacto', desde: s(74), dura: s(6), voz: 'Casi cuatrocientos productos. Un solo enlace. Cero pedidos escritos a mano.' },
  {
    id: 'cierre',
    desde: s(80),
    dura: s(10),
    voz: 'Jasta. Vende mientras tu cliente elige. Busca tu enlace en Más, Pedidos de la tienda, y compártelo hoy.',
  },
];

export const TOTAL = s(90);
/** Fotogramas que se solapan dos escenas al pasar de una a otra */
export const CRUCE = 14;
