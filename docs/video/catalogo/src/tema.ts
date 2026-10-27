import { continueRender, delayRender, staticFile } from 'remotion';

// Los mismos colores de la app Jasta
export const C = {
  fondo: '#F3F4F6',
  blanco: '#FFFFFF',
  texto: '#0F172A',
  suave: '#4B5563',
  tenue: '#6B7280',
  borde: '#E5E7EB',
  bordeFuerte: '#D1D5DB',
  superficie2: '#F3F4F6',
  azul: '#2563EB',
  azulWash: '#EFF6FF',
  azulSoft: '#DBEAFE',
  oro: '#D4A017',
  oroTexto: '#8A6508',
  oroWash: '#FEF3C7',
  verde: '#16A34A',
  verdeTexto: '#15803D',
  verdeWash: '#DCFCE7',
  rojo: '#DC2626',
  rojoWash: '#FEE2E2',
  whatsapp: '#25D366',
};

export const FUENTE = "'Geist', system-ui, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, monospace";

// Las fuentes vienen del proyecto (sin internet al renderizar)
const espera = delayRender('fuentes');
Promise.all([
  new FontFace('Geist', `url(${staticFile('fonts/geist.woff2')})`, { weight: '100 900' }).load(),
  new FontFace('Geist Mono', `url(${staticFile('fonts/geist-mono.woff2')})`, { weight: '100 900' }).load(),
])
  .then((fs) => {
    fs.forEach((f) => (document.fonts as unknown as { add(x: FontFace): void }).add(f));
    continueRender(espera);
  })
  .catch(() => continueRender(espera));

export const pesos = (n: number) => '$ ' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
