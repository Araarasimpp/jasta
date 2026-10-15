/** Descarga una tabla como CSV que Excel abre con tildes y columnas bien separadas */
export function descargarCsv<T>(nombre: string, columnas: { titulo: string; valor: (f: T) => unknown }[], filas: T[]): void {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [columnas.map((c) => esc(c.titulo)).join(';'), ...filas.map((f) => columnas.map((c) => esc(c.valor(f))).join(';'))];
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre.endsWith('.csv') ? nombre : nombre + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
