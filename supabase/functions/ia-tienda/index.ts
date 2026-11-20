// Edge Function ia-tienda: ordena sola la dirección de los pedidos que llegan por la tienda en línea.
//
// La llama la base (disparador de pedidos_web, con pg_net) apenas entra un pedido:
//   POST { id }   con el encabezado x-ia-interno = la clave 'ia_interno' del Vault.
// La IA (Gemini, plan gratis) ordena la dirección ("cra 80 n 12 40" -> "Carrera 80 # 12-40");
// la que escribió el cliente queda en pedidos_web.direccion_original. Si la IA no responde
// (por ejemplo, por el límite del plan gratis), el pedido queda como lo escribió el cliente.
//
// Se despliega con verify_jwt = false: quien llama es la base, con la clave interna.
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });
const MODELOS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];

let cache: { interno: string | null; gemini: string | null; hasta: number } = { interno: null, gemini: null, hasta: 0 };
async function claves(): Promise<typeof cache> {
  if (Date.now() < cache.hasta) return cache;
  const filas = await sql<{ name: string; v: string }[]>`
    select name, decrypted_secret as v from vault.decrypted_secrets where name in ('ia_interno', 'gemini_api_key')`;
  const de = (n: string) => filas.find((f) => f.name === n)?.v ?? null;
  cache = { interno: de('ia_interno'), gemini: de('gemini_api_key'), hasta: Date.now() + 5 * 60_000 };
  return cache;
}

/** Compara sin filtrar por tiempo cuánto coincide */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const DIRECCION = (t: string) => `Ordena esta dirección de Colombia con el formato usual: tipo de vía completo y número, "#", la placa con guion, y lo demás (apto, torre, casa, interior) al final.
Ejemplos: "cl 5 38 25 apto 3" -> "Calle 5 # 38-25 apto 3"; "kra 45#12 30" -> "Carrera 45 # 12-30"; "diag 55 n 34-80 casa 2" -> "Diagonal 55 # 34-80 casa 2".
No agregues barrio ni ciudad ni nada que no esté. Si no parece una dirección, devuélvela igual. Responde solo con la dirección.
Dirección: ${t}`;

async function ordenar(llave: string, texto: string): Promise<string | null> {
  for (const m of MODELOS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(llave)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: DIRECCION(texto) }] }], generationConfig: { temperature: 0.1 } }),
    });
    const d = await r.json().catch(() => ({}));
    const t = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (r.ok && t.trim()) return t.replace(/^["']|["']$/g, '').trim();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('no', { status: 405 });
  const c = await claves();
  const enviada = req.headers.get('x-ia-interno') ?? '';
  if (!c.interno || !enviada || !igual(enviada, c.interno)) return new Response('no', { status: 401 });
  try {
    const { id } = await req.json();
    if (!Number.isInteger(Number(id))) return new Response('id', { status: 400 });
    const [w] = await sql<{ direccion: string | null; direccion_original: string | null }[]>`
      select direccion, direccion_original from public.pedidos_web where id = ${Number(id)}`;
    const original = (w?.direccion ?? '').trim();
    if (!w || w.direccion_original || original.length <= 4 || !c.gemini) return new Response('ok');
    const nueva = await ordenar(c.gemini, original.slice(0, 200));
    if (nueva && nueva.length <= 250 && nueva !== original) {
      // Solo si nadie la cambió mientras la IA respondía
      await sql`update public.pedidos_web set direccion_original = direccion, direccion = ${nueva}
        where id = ${Number(id)} and direccion = ${w.direccion} and direccion_original is null`;
    }
    return new Response('ok');
  } catch (e) {
    console.error('ia-tienda', e);
    return new Response('error', { status: 500 });
  }
});
