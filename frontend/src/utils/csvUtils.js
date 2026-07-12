/**
 * Utilidad para generación y descarga de archivos CSV en el frontend.
 *
 * Uso:
 *   downloadCSV('reporte_ventas', ['Número', 'Fecha', 'Total'], [
 *     ['V-001', '2026-07-08', 1500],
 *     ['V-002', '2026-07-08', 2300],
 *   ]);
 */

function escapeCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  // Envuelve en comillas si contiene coma, comilla doble o salto de línea
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

/**
 * Genera y descarga un archivo CSV con BOM (compatibilidad Excel).
 *
 * @param {string}     filename - Nombre del archivo (sin extensión o con .csv)
 * @param {string[]}   headers  - Títulos de columnas
 * @param {Array[]}    rows     - Filas de datos (arrays planos de valores)
 */
export function downloadCSV(filename, headers, rows) {
  const header = headers.map(h => `"${h}"`).join(',');
  const body   = rows.map(row => row.map(escapeCell).join(',')).join('\n');
  const blob   = new Blob(['\uFEFF' + header + '\n' + body], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
