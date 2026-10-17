import { strFromU8, unzipSync } from 'fflate';

export type CeldaExcel = string | number | boolean | null;

/** Columna de la celda: "A1" → 0, "AB7" → 27 */
function columna(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Texto de un nodo <si> o <is> (puede venir partido en varios <r><t>) */
function texto(nodo: Element): string {
  return Array.from(nodo.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('');
}

function hijo(e: Element, nombre: string): Element | null {
  return Array.from(e.children).find((c) => c.localName === nombre) ?? null;
}

/** Ruta de la primera hoja según el libro (no siempre es sheet1.xml) */
function rutaPrimeraHoja(arch: Record<string, Uint8Array>, dom: DOMParser): string {
  const libro = arch['xl/workbook.xml'];
  const rels = arch['xl/_rels/workbook.xml.rels'];
  if (libro && rels) {
    const hoja = dom.parseFromString(strFromU8(libro), 'application/xml').getElementsByTagName('sheet')[0];
    const id = hoja?.getAttribute('r:id') ?? hoja?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = Array.from(dom.parseFromString(strFromU8(rels), 'application/xml').getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === id);
    const destino = rel?.getAttribute('Target');
    if (destino) {
      const ruta = destino.startsWith('/') ? destino.slice(1) : 'xl/' + destino.replace(/^\.\//, '');
      if (arch[ruta]) return ruta;
    }
  }
  const primera = Object.keys(arch).filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0];
  if (!primera) throw new Error('El archivo no tiene hojas.');
  return primera;
}

/** Lee la primera hoja de un .xlsx como filas de celdas */
export function leerXlsx(datos: Uint8Array): CeldaExcel[][] {
  let arch: Record<string, Uint8Array>;
  try {
    arch = unzipSync(datos);
  } catch {
    throw new Error('El archivo no es un Excel (.xlsx) válido.');
  }
  const dom = new DOMParser();
  const compartidos = arch['xl/sharedStrings.xml']
    ? Array.from(dom.parseFromString(strFromU8(arch['xl/sharedStrings.xml']), 'application/xml').getElementsByTagName('si')).map(texto)
    : [];
  const hoja = dom.parseFromString(strFromU8(arch[rutaPrimeraHoja(arch, dom)]), 'application/xml');
  const filas: CeldaExcel[][] = [];
  for (const row of Array.from(hoja.getElementsByTagName('row'))) {
    const r = Number(row.getAttribute('r')) - 1;
    const fila: CeldaExcel[] = [];
    let siguiente = 0;
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const i = ref ? columna(ref) : siguiente;
      siguiente = i + 1;
      const t = c.getAttribute('t');
      const v = hijo(c, 'v')?.textContent ?? null;
      let valor: CeldaExcel = null;
      if (t === 's') valor = v === null ? null : compartidos[Number(v)] ?? null;
      else if (t === 'inlineStr') valor = hijo(c, 'is') ? texto(hijo(c, 'is')!) : null;
      else if (t === 'str') valor = v;
      else if (t === 'b') valor = v === '1';
      else if (v !== null && v !== '') valor = Number.isFinite(Number(v)) ? Number(v) : v;
      fila[i] = valor;
    }
    filas[Number.isFinite(r) && r >= 0 ? r : filas.length] = Array.from(fila, (x) => x ?? null);
  }
  return Array.from(filas, (f) => f ?? []);
}

/** Lee un .csv (separado por coma o punto y coma, como lo guarda Excel en español) */
export function leerCsv(textoCsv: string): CeldaExcel[][] {
  const limpio = textoCsv.replace(/^﻿/, '');
  const primera = limpio.split(/\r?\n/)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: CeldaExcel[][] = [];
  let fila: CeldaExcel[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i];
    if (comillas) {
      if (ch === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (ch === '"') comillas = false;
      else campo += ch;
    } else if (ch === '"') comillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += ch;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

/** Lee el archivo que eligió la persona (.xlsx o .csv) */
export async function leerHojaDeCalculo(archivo: File): Promise<CeldaExcel[][]> {
  if (/\.csv$/i.test(archivo.name) || archivo.type === 'text/csv') return leerCsv(await archivo.text());
  if (/\.xls$/i.test(archivo.name)) throw new Error('Ese es un Excel antiguo (.xls). Ábrelo y guárdalo como "Libro de Excel (.xlsx)".');
  return leerXlsx(new Uint8Array(await archivo.arrayBuffer()));
}
