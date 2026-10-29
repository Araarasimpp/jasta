// Rótulo de Variedades JYB (Kaesuri), para imprimirlo desde Jasta sin cambiar de app.
// Mismo diseño que el de la app de Variedades JYB (logo, contacto, QR "KAESURI-…" que lee
// su bot de Telegram). Las clases van con el prefijo "rj-" para poder mezclarlo con los
// rótulos de Jasta en un mismo documento de impresión (documentoRotulos + ROTULO_JYB_CSS).
import qrcode from 'qrcode-generator';
import { DatosNegocio } from './rotulo';

export interface PedidoRotuloJyb {
  numero: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  direccion: string | null;
  barrio: string | null;
  observaciones: string | null;
  total: number;
  created_at: string;
  items: { nombre: string; cantidad: number }[];
}

/** Si Variedades JYB no manda sus datos */
export const NEGOCIO_JYB: DatosNegocio = {
  nombre_negocio: 'Variedades JYB',
  telefonos: '318 8156960 - 310 7425663',
  redes: '@variedadesjyb',
  texto_garantia: 'Todos nuestros productos cuentan con garantía. Guarda este documento ya que es el soporte para la garantía.',
};

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function moneda(v: number): string {
  return Number(v || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
}

/** El documento se imprime desde un marco aparte: el logo necesita la dirección completa */
function urlLogo(): string {
  return new URL('assets/icon/logo-rotulo-jyb.png', document.baseURI).href;
}

/** QR "KAESURI-215": lo lee el bot de Telegram de Variedades JYB */
function qrJyb(numero: number): string {
  const q = qrcode(0, 'Q');
  q.addData(`KAESURI-${numero}`, 'Alphanumeric');
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 8, scalable: true }).replace('<svg ', '<svg shape-rendering="crispEdges" ');
}

function fecha(iso: string): string {
  const [anio, mes, dia] = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).split('-');
  return `${dia} / ${mes} / ${anio}`;
}

/** Un rótulo de Variedades JYB. Todo el texto que viene de la base de datos se escapa. */
export function rotuloJybHtml(p: PedidoRotuloJyb, n: DatosNegocio): string {
  const productos = p.items.map((i) => `${esc(i.nombre)} x${i.cantidad}`).join('<br>');
  return `
<section class="rj">
  <div class="rj-cab">
    <img class="rj-logo" src="${urlLogo()}" alt="${esc(n.nombre_negocio)}" />
    <div class="rj-qr">${qrJyb(p.numero)}<span>#${esc(p.numero)}</span></div>
    <div class="rj-der">
      <div class="rj-contacto">
        ${n.telefonos ? `<div>${esc(n.telefonos)}</div>` : ''}
        ${n.redes ? `<div>${esc(n.redes)}</div>` : ''}
      </div>
      <div class="rj-fecha">${fecha(p.created_at)}</div>
    </div>
  </div>
  <div class="rj-cobro"><span>VALOR A COBRAR:</span><strong>${moneda(p.total)}</strong></div>
  <table class="rj-datos">
    <tr><td>Pedido:</td><td>#${esc(p.numero)}</td></tr>
    <tr><td>Nombre:</td><td>${esc(p.cliente_nombre)}</td></tr>
    <tr><td>Dirección:</td><td>${esc(p.direccion ?? '—')}</td></tr>
    <tr><td>Barrio:</td><td>${esc(p.barrio ?? '—')}</td></tr>
    <tr><td>Producto:</td><td>${productos || '—'}</td></tr>
    <tr><td>Celular:</td><td>${esc(p.cliente_telefono ?? '—')}</td></tr>
    <tr><td>Observación:</td><td>${esc(p.observaciones ?? '—')}</td></tr>
  </table>
  ${n.texto_garantia ? `<p class="rj-garantia">${esc(n.texto_garantia)}</p>` : ''}
</section>`;
}

/** Estilos del rótulo de Variedades JYB (van junto a ROTULO_CSS en documentoRotulos) */
export const ROTULO_JYB_CSS = `
  .rj {
    width: 100%;
    height: 100vh;
    padding: 2.5mm 3mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .rj:last-child { page-break-after: auto; break-after: auto; }
  .rj-cab { display: flex; justify-content: space-between; align-items: center; gap: 3mm; margin-bottom: 2.5mm; }
  .rj-logo { width: 28mm; height: 28mm; object-fit: contain; flex-shrink: 0; }
  .rj-qr { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 0.6mm; }
  .rj-qr svg { display: block; width: 24mm; height: 24mm; margin: -2mm; }
  .rj-qr span { font-size: 7pt; font-weight: bold; letter-spacing: 0.04em; }
  .rj-der { display: flex; flex-direction: column; align-items: flex-end; gap: 2mm; min-width: 0; }
  .rj-contacto { font-size: 8.5pt; text-align: right; line-height: 1.3; word-break: break-word; }
  .rj-fecha { border: 0.3mm solid #000; padding: 1mm 2mm; font-size: 8.5pt; white-space: nowrap; }
  .rj-cobro { border: 0.4mm solid #000; padding: 1.5mm 2.5mm; margin-bottom: 2mm; font-size: 10pt; display: flex; justify-content: space-between; align-items: center; }
  .rj-cobro strong { font-size: 13pt; }
  .rj-datos { width: 100%; font-size: 9pt; border-collapse: collapse; }
  .rj-datos td { padding: 0.6mm 0; vertical-align: top; }
  .rj-datos td:first-child { font-weight: bold; width: 21mm; }
  .rj-garantia { margin-top: auto; font-size: 6.5pt; line-height: 1.25; text-align: center; border-top: 0.3mm dashed #000; padding-top: 1.5mm; }
  @media screen { .rj { width: 100mm; height: 100mm; margin: 0 auto 16px; background: #fff; } }
`;
