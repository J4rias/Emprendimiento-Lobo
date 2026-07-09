import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import {
  Card, DateRangeFilter, getDefaultDateRange, ExportCsvAction,
  Pagination, SearchInput, Select, useTableLimit,
} from '../components/ui';
import { MovementTypeBadge, MOVEMENT_TYPE_OPTIONS } from '../components/inventory/MovementTypeBadge';
import { downloadCSV } from '../utils/csvUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) => new Date(d).toLocaleDateString('es-VE');

const getUserName = (user) => {
  if (!user) return 'Sistema';
  return `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Sistema';
};

// ─── Página ───────────────────────────────────────────────────────────────────

const InventoryMovementsPage = () => {
  const navigate = useNavigate();
  const [page, setPage]           = useState(1);
  const [limit, setLimit]         = useTableLimit();
  const [search, setSearch]       = useState('');
  const [movType, setMovType]     = useState('');
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [sortBy, setSortBy]       = useState('created_at');
  const [sortDir, setSortDir]     = useState('desc');

  const handleSearch    = (v)    => { setSearch(v);    setPage(1); };
  const handleTypeChange = (v)   => { setMovType(v);   setPage(1); };
  const handleDateChange = (r)   => { setDateRange(r); setPage(1); };

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-movements-global', page, limit, search, movType, dateRange, sortBy, sortDir],
    queryFn: () =>
      inventoryService.getMovements({
        page,
        limit,
        search:        search || undefined,
        movement_type: movType || undefined,
        date_from:     dateRange.start_date || undefined,
        date_to:       dateRange.end_date   || undefined,
        sort_by:       sortBy,
        sort_dir:      sortDir,
      }),
    keepPreviousData: true,
  });

  const movements   = data?.data         || [];
  const pagination  = data?.pagination   || {};
  const totalPages  = pagination.totalPages || 1;
  const total       = pagination.total      || 0;

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = ['Fecha', 'Producto', 'SKU', 'Tipo', 'Presentación', 'Bultos', 'Sueltas', 'Total uds', 'Almacén', 'Referencia', 'Usuario'];
    const rows = movements.map(m => {
      const upu    = parseInt(m.presentation?.units_per_package, 10) || 0;
      const qty    = Math.floor(parseFloat(m.quantity) || 0);
      const bultos  = upu > 0 ? Math.floor(qty / upu) : 0;
      const sueltas = upu > 0 ? qty % upu : qty;
      return [
        fmtDate(m.createdAt || m.created_at),
        m.product?.name || '',
        m.product?.sku  || '',
        m.movement_type || '',
        m.presentation?.name || '',
        bultos  || '',
        sueltas || '',
        qty,
        m.warehouse?.name || '',
        m.document_number || '',
        getUserName(m.user),
      ];
    });
    downloadCSV(`movimientos_inventario`, headers, rows);
  };

  // ── Columnas ───────────────────────────────────────────────────────────────
  const columns = [
    {
      header: 'Fecha',
      render: (m) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {fmtDate(m.createdAt || m.created_at)}
        </span>
      ),
    },
    {
      header: 'Producto',
      render: (m) => {
        const inventoryId = m.product?.inventories?.[0]?.id;
        return (
          <div>
            <button
              onClick={() => inventoryId && navigate(`/inventario/${inventoryId}`)}
              disabled={!inventoryId}
              className={`text-sm font-medium text-left ${
                inventoryId
                  ? 'text-primary-600 hover:text-primary-800 hover:underline cursor-pointer'
                  : 'text-gray-900 cursor-default'
              }`}
            >
              {m.product?.name || '—'}
            </button>
            <div className="text-xs text-gray-400">{m.product?.sku}</div>
          </div>
        );
      },
    },
    {
      header: 'Tipo',
      render: (m) => <MovementTypeBadge type={m.movement_type} />,
    },
    {
      header: 'Presentación',
      render: (m) => (
        <span className="text-sm text-gray-600">
          {m.presentation?.name || <span className="text-gray-400 italic">—</span>}
        </span>
      ),
    },
    {
      header: 'Bultos',
      className: 'text-right',
      render: (m) => {
        const upu = parseInt(m.presentation?.units_per_package, 10) || 0;
        const qty = Math.floor(parseFloat(m.quantity) || 0);
        const bultos = upu > 0 ? Math.floor(qty / upu) : 0;
        return bultos > 0
          ? <span className="text-sm font-medium text-right block">{bultos}</span>
          : <span className="text-xs text-gray-300 text-right block">—</span>;
      },
    },
    {
      header: 'Sueltas',
      className: 'text-right',
      render: (m) => {
        const upu = parseInt(m.presentation?.units_per_package, 10) || 0;
        const qty = Math.floor(parseFloat(m.quantity) || 0);
        const sueltas = upu > 0 ? qty % upu : qty;
        return sueltas > 0
          ? <span className="text-sm font-medium text-right block">{sueltas}</span>
          : <span className="text-xs text-gray-300 text-right block">—</span>;
      },
    },
    {
      header: 'Almacén',
      render: (m) => (
        <span className="text-sm text-gray-600">{m.warehouse?.name || '—'}</span>
      ),
    },
    {
      header: 'Referencia',
      render: (m) => {
        if (!m.document_number) return <span className="text-gray-300 text-xs">—</span>;
        const isSale = ['egreso', 'egreso_venta', 'venta', 'devolucion_cliente'].includes(m.movement_type);
        const dest = isSale
          ? null  // manejado vía state con sale_id
          : {
              ingreso: '/purchase-orders', ingreso_compra: '/purchase-orders', compra: '/purchase-orders', devolucion_proveedor: '/purchase-orders',
              transferencia: '/transferencias', transferencia_entrada: '/transferencias', transferencia_salida: '/transferencias',
            }[m.movement_type] ?? null;

        const handleClick = () => {
          if (isSale && m.sale_id) {
            navigate('/ventas', { state: { openSaleId: m.sale_id } });
          } else if (dest) {
            navigate(dest);
          }
        };

        const isClickable = (isSale && !!m.sale_id) || !!dest;

        return (
          <button
            onClick={isClickable ? handleClick : undefined}
            disabled={!isClickable}
            className={`text-xs font-mono text-left ${
              isClickable
                ? 'text-primary-600 hover:text-primary-800 hover:underline cursor-pointer'
                : 'text-gray-600 cursor-default'
            }`}
          >
            {m.document_number}
          </button>
        );
      },
    },
    {
      header: 'Usuario',
      render: (m) => (
        <span className="text-xs text-gray-500">{getUserName(m.user)}</span>
      ),
    },
  ];

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClockCounterClockwise className="w-6 h-6 text-gray-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Historial de Movimientos</h1>
            <p className="text-gray-500 text-sm mt-0.5">Registro completo de todos los movimientos de inventario</p>
          </div>
        </div>
        {movements.length > 0 && (
          <ExportCsvAction onClick={handleExport} title="Exportar CSV" />
        )}
      </div>

      {/* Filtros */}
      <Card variant="flat">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={handleSearch}
              placeholder="Buscar por producto o SKU..."
            />
          </div>
          <DateRangeFilter
            startDate={dateRange.start_date}
            endDate={dateRange.end_date}
            onChange={handleDateChange}
            showPresets
          />
          <div className="w-48">
            <Select
              value={movType}
              onChange={(e) => handleTypeChange(e.target.value)}
              options={MOVEMENT_TYPE_OPTIONS}
            />
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card variant="flat" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      col.className?.includes('text-right') ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-12 text-gray-400 text-sm">
                    No se encontraron movimientos
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    {columns.map((col, i) => (
                      <td
                        key={i}
                        className={`px-4 py-3 ${col.className || ''}`}
                      >
                        {col.render(m)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      </Card>
    </div>
  );
};

export default InventoryMovementsPage;
