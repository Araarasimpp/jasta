/**
 * Lee un mensaje de WhatsApp del cliente y saca los datos del pedido: celular, nombre,
 * dirección, barrio, observaciones y productos con su cantidad. Funciona sin inteligencia
 * artificial (por palabras); lo que no entiende lo devuelve para que se revise a mano.
 */
export interface ProductoBuscable { id: number; nombre: string; sku?: string | null }
export interface BarrioBuscable { barrio: string; domicilio: number }
export interface PedidoLeido<P extends ProductoBuscable, B extends BarrioBuscable> {
  telefono: string | null;
  nombre: string | null;
  direccion: string | null;
  barrio: B | null;
  barrioTexto: string | null;
  observaciones: string | null;
  items: { producto: P; cantidad: number; texto: string }[];
  sinEntender: string[];
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NUMEROS: Record<string, number> = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, par: 2 };
/** Palabras que no ayudan a reconocer un producto */
const RUIDO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'y', 'en', 'un', 'una', 'uno', 'unos', 'unas', 'quiero', 'necesito',
  'me', 'mandas', 'manda', 'porfa', 'favor', 'hola', 'buenas', 'gracias', 'x', 'und', 'unidad', 'unidades', 'color', 'talla', 'el', 'lo', 'que']);
const VIA = /\b(cra|cr|kr|kra|carrera|calle|cll|cl|av|avenida|diagonal|diag|dg|transversal|trans|tv|tr|autopista|via|vía|circular|manzana|mz)\b\.?\s*\d/i;
const OBS = /\b(antes de|despu[eé]s de|llamar|timbrar|porter[ií]a|portero|horario|entregar|entrega|a partir de|en la tarde|en la ma[nñ]ana|en la noche|urgente|regalo)\b/i;

function tokens(s: string): string[] {
  return normal(s).replace(/[^a-z0-9ñ ]+/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !RUIDO.has(t));
}

export function leerPedido<P extends ProductoBuscable, B extends BarrioBuscable>(texto: string, productos: P[], barrios: B[]): PedidoLeido<P, B> {
  const r: PedidoLeido<P, B> = { telefono: null, nombre: null, direccion: null, barrio: null, barrioTexto: null, observaciones: null, items: [], sinEntender: [] };
  const lineas = texto.replace(/\r/g, '').split(/\n+/).map((l) => l.replace(/^[\s*•\-–·>]+/, '').trim()).filter(Boolean);
  const obs: string[] = [];
  const tokProd = productos.map((p) => ({ p, t: new Set(tokens(p.nombre + ' ' + (p.sku ?? ''))) }));

  for (const lineaOriginal of lineas) {
    let linea = lineaOriginal;
    // Celular
    const tel = linea.match(/(?:\+?57[\s-]*)?(3\d{2})[\s.-]*(\d{3})[\s.-]*(\d{4})\b/);
    if (tel && !r.telefono) {
      r.telefono = tel[1] + tel[2] + tel[3];
      linea = linea.replace(tel[0], ' ').trim();
      linea = linea.replace(/^(cel(ular)?|tel(efono|éfono)?|whatsapp|n[uú]mero)\s*:?\s*/i, '').trim();
      if (!linea || /^[,.:;-]*$/.test(linea)) continue;
    }
    // Etiquetas comunes: "Nombre: …", "Dirección: …", "Barrio: …"
    const etq = linea.match(/^(nombre|cliente|recibe|a nombre de|direcci[oó]n|dir|barrio|obs|observaci[oó]n(es)?|nota)\s*:?\s+(.+)$/i);
    if (etq) {
      const k = normal(etq[1]);
      const v = etq[3].trim();
      if (/nombre|cliente|recibe/.test(k)) { r.nombre = r.nombre ?? v; continue; }
      if (/dir/.test(k)) { r.direccion = r.direccion ?? v; continue; }
      if (/barrio/.test(k)) { r.barrioTexto = r.barrioTexto ?? v; continue; }
      obs.push(v);
      continue;
    }
    // Dirección (empieza por Cra, Calle, Av…); si trae "barrio X" al final, se separa
    if (!r.direccion && VIA.test(linea)) {
      const i = linea.search(VIA);
      let dir = linea.slice(i).trim();
      const b = dir.match(/[,\s]+(?:barrio|b\/|br)\.?\s*:?\s*(.+)$/i);
      if (b) { r.barrioTexto = r.barrioTexto ?? b[1].trim(); dir = dir.slice(0, b.index).trim(); }
      r.direccion = dir.replace(/[,.;]+$/, '');
      continue;
    }
    const b = linea.match(/(?:\bbarrio|^b\/|^br\.)\s*:?\s*(.+)$/i);
    if (b) { r.barrioTexto = r.barrioTexto ?? b[1].trim(); continue; }
    if (OBS.test(linea)) { obs.push(linea); continue; }

    // Productos: puede haber varios en la misma línea ("2 relojes casio y 1 cadena")
    let algo = false;
    for (const parte of linea.split(/,|;|\s+y\s+|\s+\+\s+/i).map((x) => x.trim()).filter(Boolean)) {
      // Sin saludos ni "quiero" al principio, para que la cantidad quede de primera
      let n = normal(parte);
      for (let k = 0; k < 4; k++) n = n.replace(/^(hola|buenas|buenos dias|buenas tardes|quiero|necesito|me mandas|mandame|me regalas|regalame|dame|deme|porfa|por favor|me|para)\s+/, '');
      let cantidad = 1;
      const num = n.match(/^(\d{1,3})\b|\bx\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:und|unidades|uds|pares)\b/);
      if (num) cantidad = Number(num[1] ?? num[2] ?? num[3]) || 1;
      else {
        const pal = n.match(/^(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|par)\b/);
        if (pal) cantidad = NUMEROS[pal[1]] ?? 1;
      }
      const tk = tokens(parte).filter((t) => !/^\d+$/.test(t) || t.length > 3);
      if (!tk.length) continue;
      let mejor: { p: P; puntos: number } | null = null;
      for (const { p, t } of tokProd) {
        if (!t.size) continue;
        let hit = 0;
        for (const w of tk) if (t.has(w) || [...t].some((x) => x.length > 3 && (x.startsWith(w) || w.startsWith(x)))) hit++;
        const puntos = hit / Math.max(t.size, 1) + hit / tk.length;
        if (hit >= 1 && (!mejor || puntos > mejor.puntos)) mejor = { p, puntos };
      }
      if (mejor && mejor.puntos >= 0.7) {
        const ya = r.items.find((x) => x.producto.id === mejor!.p.id);
        if (ya) ya.cantidad += cantidad;
        else r.items.push({ producto: mejor.p, cantidad: Math.min(cantidad, 99), texto: parte });
        algo = true;
      } else if (tk.length >= 1 && parte.length > 2) {
        r.sinEntender.push(parte);
      }
    }
    // Una línea corta sin productos suele ser el nombre ("Soy Laura Pérez" o solo "Laura Gómez")
    if (!algo && !r.nombre) {
      const nom = lineaOriginal.match(/^(?:soy|me llamo|mi nombre es|a nombre de)\s+([a-záéíóúñ ]{3,40})$/i)
        ?? lineaOriginal.match(/^([a-záéíóúñ]{2,}(?: [a-záéíóúñ]{2,}){1,3})$/i);
      if (nom) { r.nombre = nom[1].trim(); r.sinEntender = r.sinEntender.filter((x) => !lineaOriginal.includes(x)); }
    }
  }

  // Barrio: el de la tabla que aparezca (el nombre más largo que coincida)
  const buscar = normal(r.barrioTexto ?? texto);
  const cand = barrios
    .filter((x) => x.barrio && new RegExp(`(^|[^a-z0-9])${normal(x.barrio).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(buscar))
    .sort((a, b) => b.barrio.length - a.barrio.length);
  r.barrio = cand[0] ?? null;
  // Si la dirección termina con el barrio, se le quita (queda solo en Barrio)
  if (r.barrio && r.direccion) {
    const re = new RegExp(`[,\\s-]*${normal(r.barrio.barrio).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    const sin = normal(r.direccion).replace(re, '');
    if (sin.length < normal(r.direccion).length) r.direccion = r.direccion.slice(0, sin.length).replace(/[,\s-]+$/, '');
  }
  if (r.barrio && r.barrioTexto) r.sinEntender = r.sinEntender.filter((x) => !normal(r.barrioTexto!).includes(normal(x)));
  r.observaciones = obs.length ? obs.join('. ') : null;
  return r;
}
