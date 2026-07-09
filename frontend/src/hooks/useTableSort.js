import { useState, useMemo } from 'react';

function getVal(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

/**
 * Hook de ordenación para tablas.
 *
 * @param {Array}  data              — datos a ordenar (ignorado en modo serverSide)
 * @param {Object} opts
 * @param {string} opts.defaultField — campo inicial de ordenación
 * @param {string} opts.defaultDir  — dirección inicial ('asc' | 'desc')
 * @param {boolean} opts.serverSide — cuando true, no ordena client-side;
 *                                    devuelve sortBy/sortDir para pasarlos al API
 */
export function useTableSort(data = [], opts = {}) {
  const { defaultField = '', defaultDir = 'asc', serverSide = false } = opts;

  const [sortBy, setSortBy] = useState(defaultField);
  const [sortDir, setSortDir] = useState(defaultDir);

  const onSort = (field, dir) => { setSortBy(field); setSortDir(dir); };

  const sortedData = useMemo(() => {
    if (serverSide || !sortBy || !data.length) return data;
    return [...data].sort((a, b) => {
      const va = getVal(a, sortBy) ?? '';
      const vb = getVal(b, sortBy) ?? '';
      if (typeof va === 'number' && typeof vb === 'number')
        return sortDir === 'asc' ? va - vb : vb - va;
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb), 'es', { numeric: true })
        : String(vb).localeCompare(String(va), 'es', { numeric: true });
    });
  }, [data, sortBy, sortDir, serverSide]);

  return { sortBy, sortDir, onSort, sortedData };
}
