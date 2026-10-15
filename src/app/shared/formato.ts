import { environment } from '../../environments/environment';

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function pesos(v: number | null | undefined): string {
  return COP.format(Number(v ?? 0)).replace(/\s/g, ' ');
}

export function numero(v: number | null | undefined): string {
  return NUM.format(Number(v ?? 0));
}

/** Rutas de WordPress ("2026/07/foto.jpg") o URLs completas → URL que se puede mostrar */
export function urlImagen(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  if (/^https?:\/\//.test(ruta)) return ruta;
  return environment.uploadsUrl + ruta.replace(/^\/+/, '');
}

/** Mensaje legible a partir de un error de Supabase */
export function mensajeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e);
  return m.replace(/^.*?ERROR:\s*/, '');
}
