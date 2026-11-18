// Edge Function ia: ayudas con inteligencia artificial (Gemini de Google, plan gratis).
//
// POST { accion: 'leer_pedido', texto, productos: [{ id, nombre }], barrios: [nombre] }
//   -> { telefono, nombre, direccion, barrio, observaciones, items: [{ producto_id, cantidad, color, talla }], no_entendido: [] }
// POST { accion: 'descripcion', nombre, categoria?, precio?, colores? }  -> { texto }
// POST { accion: 'comprobante', imagen, mime }  -> { es_comprobante, valor, banco, fecha, hora, referencia, destinatario, alertas: [] }
// POST { accion: 'factura', imagen, mime, productos: [{ id, nombre }] }  -> { proveedor, fecha, total, items: [{ nombre, cantidad, costo, producto_id }] }
// POST { accion: 'transcribir', audio, mime }  -> { texto }   (también para mensajeros)
// POST { accion: 'direccion', texto }  -> { texto }
// POST { accion: 'pregunta', texto }  -> { texto }   (solo admin: responde con los datos del negocio)
//
// Solo para el equipo (sesión activa con rol). La llave está en el Vault ('gemini_api_key').
// Se prueba primero el modelo liviano y, si está ocupado, el normal.
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 });
const MODELOS = ['gemini-flash-lite-latest', 'gemini-flash-latest'];
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

/** El usuario del token (ya verificado por Supabase) */
function sub(req: Request): string | null {
  try {
    const t = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof p.sub === 'string' ? p.sub : null;
  } catch {
    return null;
  }
}

let llave: { v: string | null; hasta: number } = { v: null, hasta: 0 };
async function clave(): Promise<string | null> {
  if (Date.now() < llave.hasta) return llave.v;
  const [f] = await sql`select decrypted_secret as v from vault.decrypted_secrets where name = 'gemini_api_key' limit 1`;
  llave = { v: f?.v ?? null, hasta: Date.now() + 5 * 60_000 };
  return llave.v;
}

type Parte = { text: string } | { inline_data: { mime_type: string; data: string } };

async function gemini(prompt: string, comoJson: boolean, adjunto?: { data: string; mime: string }): Promise<string> {
  const k = await clave();
  if (!k) throw new Error('Falta la llave de Gemini');
  let ultimo = '';
  for (const m of MODELOS) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(k)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [...(adjunto ? [{ inline_data: { mime_type: adjunto.mime, data: adjunto.data } } as Parte] : []), { text: prompt } as Parte] }],
        generationConfig: { temperature: comoJson ? 0.1 : 0.6, ...(comoJson ? { responseMimeType: 'application/json' } : {}) },
      }),
    });
    const d = await r.json().catch(() => ({}));
    const texto = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
    if (r.ok && texto) return texto;
    ultimo = d?.error?.message ?? `Error ${r.status}`;
  }
  throw new Error(ultimo || 'La IA no respondió');
}

function leerPedido(b: { texto: string; productos: { id: number; nombre: string }[]; barrios: string[] }): string {
  const prods = (b.productos ?? []).slice(0, 1200).map((p) => `${p.id}|${p.nombre}`).join('\n');
  const barrios = (b.barrios ?? []).slice(0, 800).join(' | ');
  return `Eres el asistente de una tienda en Cali, Colombia, que vende por WhatsApp. Lee el mensaje de un cliente y saca los datos del pedido.
Responde SOLO un JSON con esta forma exacta:
{"telefono": string|null, "nombre": string|null, "direccion": string|null, "barrio": string|null, "observaciones": string|null,
 "items": [{"producto_id": number, "cantidad": number, "color": string|null, "talla": string|null}], "no_entendido": [string]}
Reglas:
- telefono: el celular colombiano de 10 dígitos que empieza por 3, solo números, sin +57. null si no hay.
- direccion: tal como la escribe el cliente (Cra, Calle, #, apto, torre…), SIN el barrio ni la ciudad.
- barrio: escoge EXACTAMENTE uno de la lista de barrios si coincide (aunque esté mal escrito); si no está, el que escribió el cliente; null si no hay.
- observaciones: indicaciones de entrega (horas, "llamar antes", portería…). null si no hay.
- items: cada producto pedido, con producto_id de la lista de productos (el más parecido, entendiendo plurales, abreviaturas y errores) y la cantidad (1 si no la dice). Si no estás seguro de cuál es, NO lo pongas en items: ponlo en no_entendido.
- No inventes datos que no estén en el mensaje.

Barrios: ${barrios}

Productos (id|nombre):
${prods}

Mensaje del cliente:
"""${String(b.texto ?? '').slice(0, 3000)}"""`;
}

function descripcion(b: { nombre: string; categoria?: string | null; precio?: number | null; colores?: string[] }): string {
  return `Escribe la descripción de un producto para el catálogo en línea de una tienda en Colombia.
Producto: ${b.nombre}
${b.categoria ? 'Categoría: ' + b.categoria : ''}
${b.colores?.length ? 'Colores disponibles: ' + b.colores.join(', ') : ''}
Reglas: español de Colombia, cercano y claro; 2 a 4 frases cortas; di para qué sirve o para quién es ideal (por ejemplo, un regalo);
NO inventes medidas, materiales, garantías ni datos técnicos que no estén en el nombre; NO uses emojis ni signos raros; NO pongas el precio; sin títulos ni listas.
Responde solo con la descripción.`;
}

const COMPROBANTE = `Esta imagen debería ser el comprobante de una transferencia o pago en Colombia (Nequi, Daviplata, Bancolombia, Davivienda, Bre-B, etc.).
Responde SOLO un JSON: {"es_comprobante": boolean, "valor": number|null, "banco": string|null, "fecha": "AAAA-MM-DD"|null, "hora": "HH:MM"|null,
"referencia": string|null, "destinatario": string|null, "alertas": [string]}
- valor: el monto transferido en pesos, como número sin puntos ni signos.
- referencia: el número de comprobante, aprobación o referencia tal cual.
- alertas: frases cortas si ves algo raro (parece editado, está recortado, no se ve el valor, no es un comprobante, es una captura de otra cosa). Vacío si se ve normal.`;

function factura(productos: { id: number; nombre: string }[]): string {
  return `Esta imagen es una factura o remisión de un proveedor de una tienda en Colombia. Saca lo que se compró.
Responde SOLO un JSON: {"proveedor": string|null, "fecha": "AAAA-MM-DD"|null, "total": number|null,
"items": [{"nombre": string, "cantidad": number, "costo": number|null, "producto_id": number|null}]}
- costo: el valor UNITARIO en pesos (si solo hay total de la línea, divídelo por la cantidad).
- producto_id: el id del producto de la tienda que corresponde (de la lista), o null si no hay uno claramente igual.
Productos de la tienda (id|nombre):
${productos.slice(0, 1200).map((p) => `${p.id}|${p.nombre}`).join('\n')}`;
}

const DIRECCION = (t: string) => `Ordena esta dirección de Colombia con el formato usual: tipo de vía completo y número, "#", la placa con guion, y lo demás (apto, torre, casa, interior) al final.
Ejemplos: "cl 5 38 25 apto 3" -> "Calle 5 # 38-25 apto 3"; "kra 45#12 30" -> "Carrera 45 # 12-30"; "diag 55 n 34-80 casa 2" -> "Diagonal 55 # 34-80 casa 2".
No agregues barrio ni ciudad ni nada que no esté. Si no parece una dirección, devuélvela igual. Responde solo con la dirección.
Dirección: ${t}`;

async function esAdmin(uid: string): Promise<boolean> {
  const [u] = await sql`select 1 from public.usuarios where auth_id = ${uid} and activo and 'admin' = any(roles::text[])`;
  return !!u;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const uid = sub(req);
    if (!uid) return json({ error: 'Inicia sesión' }, 401);
    const b = await req.json();
    // Transcribir notas de voz lo puede todo el equipo (también los mensajeros); lo demás, quien vende o administra
    const roles = b.accion === 'transcribir' ? ['admin', 'vendedora', 'alistador', 'venta_local', 'mensajero', 'cuadres'] : ['admin', 'vendedora', 'alistador', 'venta_local'];
    const [u] = await sql`select 1 from public.usuarios where auth_id = ${uid} and activo and roles::text[] && ${roles}::text[]`;
    if (!u) return json({ error: 'Sin permiso' }, 403);
    const leerJson = (t: string) => JSON.parse(t.replace(/^```(json)?|```$/g, '').trim());
    if (b.accion === 'comprobante' || b.accion === 'factura') {
      if (!(await esAdmin(uid)) && b.accion === 'comprobante') return json({ error: 'Sin permiso' }, 403);
      if (!b.imagen || String(b.imagen).length > 8_000_000) return json({ error: 'Foto no válida' }, 400);
      const prompt = b.accion === 'comprobante' ? COMPROBANTE : factura(b.productos ?? []);
      return json(leerJson(await gemini(prompt, true, { data: b.imagen, mime: b.mime || 'image/jpeg' })));
    }
    if (b.accion === 'transcribir') {
      if (!b.audio || String(b.audio).length > 12_000_000) return json({ error: 'Audio no válido' }, 400);
      const t = await gemini('Transcribe esta nota de voz en español de Colombia, tal como la dice la persona, con puntuación. Responde solo con el texto. Si no se entiende nada, responde: (no se entiende)', false,
        { data: b.audio, mime: String(b.mime || 'audio/mp4').split(';')[0] });
      return json({ texto: t.trim() });
    }
    if (b.accion === 'direccion') {
      if (!String(b.texto ?? '').trim()) return json({ error: 'Escribe la dirección' }, 400);
      return json({ texto: (await gemini(DIRECCION(String(b.texto).slice(0, 200)), false)).replace(/^["']|["']$/g, '').trim() });
    }
    if (b.accion === 'pregunta') {
      if (!(await esAdmin(uid))) return json({ error: 'Sin permiso' }, 403);
      if (!String(b.texto ?? '').trim()) return json({ error: 'Escribe la pregunta' }, 400);
      const [c] = await sql`select privado.contexto_ia() as c`;
      const t = await gemini(`Eres el asistente del dueño de Jasta, una tienda en Cali que vende por WhatsApp con vendedoras y mensajeros.
Responde su pregunta SOLO con estos datos del negocio (JSON). Si la respuesta no está en los datos, dilo y sugiere en qué parte de la app mirarlo (Reportes, Ranking, Comisiones, Inventario, Gastos).
Responde en español de Colombia, corto y claro (máximo 5 frases), con los valores en pesos con puntos de miles (ej: $1.250.000). Sin emojis. Sin tablas.
Datos: ${JSON.stringify(c.c)}
Pregunta: ${String(b.texto).slice(0, 500)}`, false);
      return json({ texto: t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?/gu, '').replace(/\*\*/g, '').trim() });
    }
    if (b.accion === 'leer_pedido') {
      if (!String(b.texto ?? '').trim()) return json({ error: 'Pega el mensaje' }, 400);
      const t = await gemini(leerPedido(b), true);
      return json(leerJson(t));
    }
    if (b.accion === 'descripcion') {
      if (!String(b.nombre ?? '').trim()) return json({ error: 'Falta el nombre del producto' }, 400);
      const t = await gemini(descripcion(b), false);
      // Sin emojis por si el modelo los pone igual
      return json({ texto: t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]\uFE0F?/gu, '').replace(/\s+\n/g, '\n').trim() });
    }
    return json({ error: 'Acción desconocida' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
