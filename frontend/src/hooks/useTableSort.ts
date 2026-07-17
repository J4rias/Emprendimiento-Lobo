import { useState, useMemo } from 'react';

function getVal(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], obj);
}

interface UseTableSortOptions {
  defaultField?: string;
  defaultDir?: 'asc' | 'desc';
  serverSide?: boolean;
}

export function useTableSort<T extends Record<string, unknown>>(data: T[] = [], opts: UseTableSortOptions = {}) {
  const { defaultField = '', defaultDir = 'asc', serverSide = false } = opts;

  const [sortBy, setSortBy] = useState(defaultField);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultDir);

  const onSort = (field: string, dir: 'asc' | 'desc') => { setSortBy(field); setSortDir(dir); };

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
