// Edge Function ia-tienda: ordena sola la dirección de los pedidos que llegan por la tienda en línea.
//
// La llama la base (disparador de pedidos_web, con pg_net) apenas entra un pedido:
//   POST { id }   con el encabezado x-ia-interno = la clave 'ia_interno' del Vault.
// La IA (Gemini, plan gratis) deja en la dirección solo la vía y la placa ("cra 80 n 12 40 conjunto
// Los Pinos torre 2, Robledo" -> "Carrera 80 # 12-40") para que Waze y Maps la encuentren; el
// conjunto, la torre o el apto pasan a las observaciones y lo que escribió el cliente queda en
// pedidos_web.direccion_original. Si la IA no responde
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

const DIRECCION = (t: string, barrio: string | null) => `Separa esta dirección de Colombia. Responde SOLO un JSON: {"direccion": string, "extra": string|null}
- direccion: SOLO la vía y la placa, con el formato usual: tipo de vía completo y número, "#", la placa con guion. Incluye letras, "Bis" y Sur/Este si son parte de la placa.
  Ejemplos: "cl 5 38 25 apto 3" -> "Calle 5 # 38-25"; "kra 45#12 30 conjunto los pinos torre 2" -> "Carrera 45 # 12-30"; "diag 55 n 34-80 casa 2" -> "Diagonal 55 # 34-80"; "Cra 7a bis 12b 30 sur" -> "Carrera 7A Bis # 12B-30 Sur".
- extra: todo lo demás que sirva para entregar, corto (conjunto o edificio, torre, bloque, apto, casa, interior, piso, local, portería, referencias), o null si no hay.
- Quita el barrio${barrio ? ' ("' + barrio + '")' : ''} y la ciudad: no van ni en direccion ni en extra.
- Si el texto no tiene una vía con número, pon el texto completo en direccion y extra null.
Texto: ${t}`;

async function ordenar(llave: string, texto: string, barrio: string | null): Promise<{ direccion: string; extra: string | null } | null> {
  for (const m of MODELOS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(llave)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: DIRECCION(texto, barrio) }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });
    const d = await r.json().catch(() => ({}));
    const t = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (!r.ok || !t.trim()) continue;
    try {
      const j = JSON.parse(t.replace(/^```(json)?|```$/g, '').trim());
      const direccion = String(j?.direccion ?? '').trim();
      if (direccion) return { direccion, extra: j?.extra ? String(j.extra).trim() : null };
    } catch { /* se prueba el otro modelo */ }
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
    const [w] = await sql<{ direccion: string | null; direccion_original: string | null; barrio: string | null }[]>`
      select direccion, direccion_original, barrio from public.pedidos_web where id = ${Number(id)}`;
    const original = (w?.direccion ?? '').trim();
    if (!w || w.direccion_original || original.length <= 4 || !c.gemini) return new Response('ok');
    const r = await ordenar(c.gemini, original.slice(0, 200), w.barrio);
    if (r && r.direccion.length <= 250 && (r.direccion !== original || r.extra)) {
      // En la dirección queda solo la vía y la placa; el conjunto, la torre o el apto pasan a las observaciones.
      // Solo si nadie la cambió mientras la IA respondía.
      const extra = r.extra && r.extra.length <= 250 ? r.extra : null;
      await sql`update public.pedidos_web set direccion_original = direccion, direccion = ${r.direccion},
          observaciones = case when ${extra}::text is null then observaciones else concat_ws(' · ', ${extra}::text, nullif(trim(observaciones), '')) end
        where id = ${Number(id)} and direccion = ${w.direccion} and direccion_original is null`;
    }
    return new Response('ok');
  } catch (e) {
    console.error('ia-tienda', e);
    return new Response('error', { status: 500 });
  }
});
