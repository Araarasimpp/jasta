import { SupabaseClient } from '@supabase/supabase-js';

/** Llama a la función "ia" del servidor (Gemini). Si tarda más de lo esperado, se rinde. */
export async function pedirIa<T>(sb: SupabaseClient, cuerpo: Record<string, unknown>, ms = 30000): Promise<T> {
  const espera = new Promise<never>((_, mal) => setTimeout(() => mal(new Error('La IA se demoró mucho. Intenta otra vez.')), ms));
  const r = sb.functions.invoke('ia', { body: cuerpo }).then(async ({ data, error }) => {
    if (error) {
      // El mensaje de error real viene en el cuerpo de la respuesta
      const ctx = (error as { context?: Response }).context;
      const det = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
      throw new Error((det as { error?: string } | null)?.error ?? 'La IA no respondió. Intenta otra vez.');
    }
    return data as T;
  });
  return Promise.race([r, espera]);
}

/** Archivo o foto a base64 (sin el encabezado "data:…") */
export function aBase64(b: Blob): Promise<string> {
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => ok(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => mal(lector.error);
    lector.readAsDataURL(b);
  });
}
