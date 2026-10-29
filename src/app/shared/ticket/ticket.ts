// Ticket de venta para impresora térmica de 58 mm (Goojprt PT-210 y parecidas, ESC/POS).
// El mismo contenido sale como bytes ESC/POS (Bluetooth o RawBT) y como HTML (vista previa).
import { Pedido } from '../modelos';
import { DatosNegocio } from '../rotulo/rotulo';
import { nombreConVariante } from '../variante';
import { formatoFechaCO, formatoHoraCO } from '../fecha-colombia';

/** Caracteres por línea con la letra normal en papel de 58 mm */
export const ANCHO = 32;

type Estilo = 'normal' | 'negrita' | 'grande';
interface Linea { texto: string; estilo?: Estilo; centro?: boolean }

const PAGO: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', mixto: 'Mixto' };

function plata(v: number | null | undefined): string {
  return '$' + Math.round(Number(v) || 0).toLocaleString('es-CO').replace(/,/g, '.');
}

/** Parte un texto en renglones del ancho dado sin cortar palabras (salvo que no quepan) */
function partir(texto: string, ancho: number): string[] {
  const out: string[] = [];
  let actual = '';
  for (const palabra of texto.replace(/\s+/g, ' ').trim().split(' ')) {
    let p = palabra;
    while (p.length > ancho) { if (actual) { out.push(actual); actual = ''; } out.push(p.slice(0, ancho)); p = p.slice(ancho); }
    if (!actual) actual = p;
    else if (actual.length + 1 + p.length <= ancho) actual += ' ' + p;
    else { out.push(actual); actual = p; }
  }
  if (actual) out.push(actual);
  return out;
}

/** Izquierda y derecha en el mismo renglón */
function aLados(izq: string, der: string, ancho = ANCHO): string {
  const espacio = ancho - der.length;
  const i = izq.length > espacio - 1 ? izq.slice(0, Math.max(0, espacio - 1)) : izq;
  return i + ' '.repeat(Math.max(1, ancho - i.length - der.length)) + der;
}

export function lineasTicket(v: Pedido, negocio: DatosNegocio): Linea[] {
  const l: Linea[] = [];
  const raya = { texto: '-'.repeat(ANCHO) };
  for (const t of partir(negocio.nombre_negocio, ANCHO / 2)) l.push({ texto: t, estilo: 'grande', centro: true });
  if (negocio.telefonos) for (const t of partir('Tel: ' + negocio.telefonos, ANCHO)) l.push({ texto: t, centro: true });
  if (negocio.redes) for (const t of partir(negocio.redes, ANCHO)) l.push({ texto: t, centro: true });
  l.push(raya);
  l.push({ texto: aLados('Venta #' + v.id, formatoHoraCO(v.created_at)), estilo: 'negrita' });
  l.push({ texto: formatoFechaCO(v.created_at, { day: 'numeric', month: 'long', year: 'numeric' }) });
  if (v.cliente_nombre && v.cliente_nombre !== 'Cliente del local') l.push({ texto: 'Cliente: ' + v.cliente_nombre });
  if (v.vendedora?.nombre) l.push({ texto: 'Te atendió: ' + v.vendedora.nombre.split(' ')[0] });
  l.push(raya);
  for (const i of v.pedido_items ?? []) {
    for (const t of partir(nombreConVariante(i), ANCHO)) l.push({ texto: t });
    l.push({ texto: aLados(`  ${i.cantidad} x ${plata(i.precio_venta)}`, plata(Number(i.precio_venta) * i.cantidad)) });
  }
  l.push(raya);
  l.push({ texto: aLados('TOTAL', plata(v.total), ANCHO / 2), estilo: 'grande' });
  l.push({ texto: '' });
  l.push({ texto: aLados('Pago', PAGO[v.tipo_recaudo ?? ''] ?? '-') });
  if (v.tipo_recaudo === 'mixto') {
    l.push({ texto: aLados('  Efectivo', plata(v.valor_efectivo)) });
    l.push({ texto: aLados('  Transferencia', plata(v.valor_transferencia)) });
  }
  if (v.estado === 'cancelado') l.push({ texto: '*** VENTA CANCELADA ***', estilo: 'negrita', centro: true });
  l.push(raya);
  if (negocio.texto_garantia) for (const t of partir(negocio.texto_garantia, ANCHO)) l.push({ texto: t, centro: true });
  l.push({ texto: '¡Gracias por tu compra!', estilo: 'negrita', centro: true });
  return l;
}

// ------------------------------------------------------------------ ESC/POS
// Página de códigos PC437 (la que traen por defecto): tiene las minúsculas con tilde y la ñ;
// las mayúsculas con tilde que no existen ahí se imprimen sin tilde.
const CP437: Record<string, number> = {
  á: 0xa0, é: 0x82, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ü: 0x81, Ü: 0x9a, É: 0x90, '¿': 0xa8, '¡': 0xad, '°': 0xf8,
};

function bytesTexto(s: string): number[] {
  const out: number[] = [];
  for (const ch of s.replace(/[  ]/g, ' ')) {
    const c = ch.charCodeAt(0);
    if (c < 128) out.push(c);
    else if (CP437[ch] != null) out.push(CP437[ch]);
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      out.push(base.length === 1 && base.charCodeAt(0) < 128 ? base.charCodeAt(0) : 0x3f);
    }
  }
  return out;
}

export function ticketEscPos(lineas: Linea[]): Uint8Array {
  const ESC = 0x1b, GS = 0x1d;
  const b: number[] = [ESC, 0x40, ESC, 0x74, 0x00]; // reiniciar + PC437
  for (const ln of lineas) {
    b.push(ESC, 0x61, ln.centro ? 1 : 0);
    b.push(ESC, 0x45, ln.estilo === 'normal' || !ln.estilo ? 0 : 1);
    b.push(GS, 0x21, ln.estilo === 'grande' ? 0x11 : 0x00);
    b.push(...bytesTexto(ln.texto), 0x0a);
  }
  b.push(ESC, 0x45, 0, GS, 0x21, 0, ESC, 0x61, 0);
  b.push(ESC, 0x64, 4); // avanzar papel para cortar con la mano
  return new Uint8Array(b);
}

// ------------------------------------------------------------------ Vista previa / impresión normal
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function ticketHtml(lineas: Linea[]): string {
  const filas = lineas.map((l) => `<div class="${l.estilo ?? 'normal'}${l.centro ? ' c' : ''}">${esc(l.texto) || '&nbsp;'}</div>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ticket</title>
<style>@page { size: 58mm auto; margin: 0 }
body { margin: 0; padding: 3mm 2mm; width: 54mm; font: 2.7mm/1.4 ui-monospace, Menlo, Consolas, monospace; color: #000; background: #fff; }
div { white-space: pre; overflow: hidden; } .c { text-align: center; } .negrita { font-weight: 700; }
.grande { font-weight: 700; font-size: 5.4mm; line-height: 1.25; }</style></head>
<body>${filas}<script>addEventListener('load', () => setTimeout(() => print(), 200));</script></body></html>`;
}
