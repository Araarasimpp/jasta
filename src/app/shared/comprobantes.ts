import { SupabaseClient } from '@supabase/supabase-js';
import { prepararFoto } from './fotos';
import { urlImagen } from './formato';

/** Los comprobantes van al bucket privado "comprobantes" y se guardan así en pedidos.evidencias */
const PREFIJO = 'sb://comprobantes/';

/** Sube la foto del comprobante a la carpeta de quien la sube y devuelve 'sb://comprobantes/…' */
export async function subirComprobante(sb: SupabaseClient, archivo: Blob): Promise<string> {
  const { data } = await sb.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('Tu sesión se cerró, vuelve a entrar');
  const blob = await prepararFoto(archivo, 1600);
  const ruta = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await sb.storage.from('comprobantes').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return PREFIJO + ruta;
}

/**
 * Direcciones para ver los comprobantes: los del bucket privado con un enlace
 * firmado de 1 hora; los viejos (de WordPress) con su dirección pública.
 */
export async function urlsComprobantes(sb: SupabaseClient, rutas: string[]): Promise<string[]> {
  const privadas = rutas.filter((r) => r.startsWith(PREFIJO)).map((r) => r.slice(PREFIJO.length));
  const firmadas = new Map<string, string>();
  if (privadas.length) {
    const { data } = await sb.storage.from('comprobantes').createSignedUrls(privadas, 3600);
    for (const f of data ?? []) if (f.path && f.signedUrl) firmadas.set(f.path, f.signedUrl);
  }
  return rutas.map((r) => (r.startsWith(PREFIJO) ? firmadas.get(r.slice(PREFIJO.length)) ?? '' : urlImagen(r) ?? ''));
}

/** Transferencia o mixto: el comprobante es obligatorio */
export function pideComprobante(tipo: string | null | undefined): boolean {
  return tipo === 'transferencia' || tipo === 'mixto';
}
