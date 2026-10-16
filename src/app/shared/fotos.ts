import { SupabaseClient } from '@supabase/supabase-js';

/** Achica la foto (máx. 1200 px) y la deja en JPEG para subirla rápido */
export async function prepararFoto(archivo: Blob, maximo = 1200): Promise<Blob> {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, maximo / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo leer la foto'))), 'image/jpeg', 0.86));
}

/** Sube una foto de producto al bucket "wp" (solo admin) y devuelve su dirección pública */
export async function subirFoto(sb: SupabaseClient, archivo: Blob, carpeta: string): Promise<string> {
  const blob = await prepararFoto(archivo);
  const ruta = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await sb.storage.from('wp').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return sb.storage.from('wp').getPublicUrl(ruta).data.publicUrl;
}
