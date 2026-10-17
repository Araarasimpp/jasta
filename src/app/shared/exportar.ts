import { strToU8, zipSync } from 'fflate';

export interface ColumnaExcel<T> {
  titulo: string;
  valor: (f: T) => unknown;
}

type Tipo = 'pesos' | 'cantidad' | 'fecha' | 'numero' | 'texto';

/** Plata: estas columnas salen con formato de pesos y su total */
const PESOS = /precio|total|venta|costo|ganancia|domicilio|efectivo|transferencia|valor|cobrado|base|compra|subtotal|productos \$/i;
/** Precios por unidad: formato de pesos pero sin total (sumarlos no dice nada) */
const UNITARIO = /^(precio|p\.)/i;
/** Siempre como texto aunque sean dígitos (no se suman ni pierden ceros) */
const TEXTO = /tel[eé]fono|celular|sku|c[oó]digo|c[eé]dula|nit|documento/i;
/** Conteos: con separador de miles y su total */
const CANTIDAD = /^(cantidad|unidades|pedidos|entregas|und\.?)$/i;

/** Qué tipo de dato lleva la columna (por el título y lo que trae) */
function tipoColumna<T>(c: ColumnaExcel<T>, filas: T[]): Tipo {
  const muestra = filas.slice(0, 50).map((f) => c.valor(f)).filter((v) => v !== null && v !== undefined && v !== '');
  if (TEXTO.test(c.titulo)) return 'texto';
  if (/^(fecha|día|dia)$/i.test(c.titulo) && muestra.every((v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))) return 'fecha';
  const numericos = muestra.length > 0 && muestra.every((v) => typeof v === 'number' || (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v)));
  if (!numericos) return 'texto';
  if (CANTIDAD.test(c.titulo)) return 'cantidad';
  if (PESOS.test(c.titulo)) return 'pesos';
  return 'numero';
}

/** "A", "B", … "Z", "AA"… */
function letra(n: number): string {
  let s = '';
  for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const xml = (s: string) =>
  s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "2026-10-16 14:32" (hora de Colombia) → número de fecha de Excel */
function serialExcel(s: string): number | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const dias = Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + 25569;
  return dias + ((+(m[4] ?? 0)) * 60 + +(m[5] ?? 0)) / 1440;
}

// Estilos (índices de cellXfs): 0 normal, 1 encabezado, 2 pesos, 3 cantidad, 4 fecha y hora, 5 fecha,
// 6 total texto, 7 total pesos, 8 total cantidad
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0;\\-&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF0F172A"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="3" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Arma el .xlsx (una hoja) en memoria */
export function libroExcel<T>(hoja: string, columnas: ColumnaExcel<T>[], filas: T[]): Uint8Array {
  const tipos = columnas.map((c) => tipoColumna(c, filas));
  const anchos = columnas.map((c, i) => {
    let max = c.titulo.length;
    for (const f of filas.slice(0, 300)) {
      const v = c.valor(f);
      const largo = tipos[i] === 'fecha' ? 16 : tipos[i] === 'pesos' ? String(Math.round(Number(v) || 0)).length + 5 : String(v ?? '').length;
      if (largo > max) max = largo;
    }
    return Math.min(60, Math.max(8, max + 2));
  });

  const celda = (ref: string, v: unknown, tipo: Tipo): string => {
    if (v === null || v === undefined || v === '') return '';
    if (tipo === 'fecha' && typeof v === 'string') {
      const n = serialExcel(v);
      if (n !== null) return `<c r="${ref}" s="${v.length > 10 ? 4 : 5}"><v>${n}</v></c>`;
    }
    if (tipo === 'pesos' || tipo === 'cantidad' || tipo === 'numero') {
      const n = Number(v);
      if (Number.isFinite(n)) return `<c r="${ref}"${tipo === 'pesos' ? ' s="2"' : tipo === 'cantidad' ? ' s="3"' : ''}><v>${n}</v></c>`;
    }
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
  };

  const ultima = letra(columnas.length - 1);
  const filasXml: string[] = [];
  filasXml.push(`<row r="1">${columnas.map((c, i) => `<c r="${letra(i)}1" t="inlineStr" s="1"><is><t>${xml(c.titulo)}</t></is></c>`).join('')}</row>`);
  filas.forEach((f, k) => {
    const r = k + 2;
    filasXml.push(`<row r="${r}">${columnas.map((c, i) => celda(`${letra(i)}${r}`, c.valor(f), tipos[i])).join('')}</row>`);
  });
  // Fila de totales con fórmulas (se recalculan si se filtra o se cambia algo)
  const suma = (i: number) => (tipos[i] === 'pesos' && !UNITARIO.test(columnas[i].titulo)) || tipos[i] === 'cantidad';
  const conTotal = filas.length > 0 && columnas.some((_, i) => suma(i));
  if (conTotal) {
    const r = filas.length + 2;
    filasXml.push(`<row r="${r}">${columnas.map((_, i) => {
      const ref = `${letra(i)}${r}`;
      if (suma(i))
        return `<c r="${ref}" s="${tipos[i] === 'pesos' ? 7 : 8}"><f>SUBTOTAL(9,${letra(i)}2:${letra(i)}${r - 1})</f></c>`;
      return i === 0 ? `<c r="${ref}" t="inlineStr" s="6"><is><t>Total</t></is></c>` : `<c r="${ref}" s="6"/>`;
    }).join('')}</row>`);
  }

  const hojaXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${filasXml.join('')}</sheetData>
${filas.length ? `<autoFilter ref="A1:${ultima}${filas.length + 1}"/>` : ''}
</worksheet>`;

  const nombreHoja = xml(hoja.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Hoja1');
  const archivos: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${nombreHoja}" sheetId="1" r:id="rId1"/></sheets>
${filas.length ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nombreHoja.replace(/'/g, "''")}'!$A$1:$${ultima}$${filas.length + 1}</definedName></definedNames>` : ''}
</workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    'xl/styles.xml': strToU8(ESTILOS),
    'xl/worksheets/sheet1.xml': strToU8(hojaXml),
  };
  return zipSync(archivos, { level: 6 });
}

/**
 * Descarga una tabla como Excel (.xlsx): encabezado fijo con filtros, pesos con
 * formato de moneda, fechas como fechas de Excel y una fila de totales.
 */
export function descargarExcel<T>(nombre: string, columnas: ColumnaExcel<T>[], filas: T[], hoja?: string): void {
  // Nombre de la hoja: "productos_vendidos_2026-10-01_a_2026-10-16" → "Productos vendidos"
  const base = nombre.replace(/_\d{4}-\d{2}-\d{2}.*$/, '').replace(/_/g, ' ').trim();
  const datos = libroExcel(hoja ?? (base.charAt(0).toUpperCase() + base.slice(1) || 'Reporte'), columnas, filas);
  const blob = new Blob([datos as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (nombre.replace(/\.(csv|xlsx)$/i, '') || 'reporte') + '.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
