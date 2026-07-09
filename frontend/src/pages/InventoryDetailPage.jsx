import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import {
  ArrowLeft, Package, Calendar, CurrencyDollar, Warning,
  Warehouse, PencilSimple, ArrowsLeftRight,
} from '@phosphor-icons/react';
import {
  Alert, Badge, Button, Card, DateRangeFilter, ExportCsvAction, getDefaultDateRange,
  Pagination, Select, Spinner, useTableLimit,
} from '../components/ui';
import { MovementTypeBadge, isPositiveMovement, MOVEMENT_TYPE_OPTIONS } from '../components/inventory/MovementTypeBadge';
import { downloadCSV } from '../utils/csvUtils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'COP', symbol: 'COP$' },
  { code: 'VES', symbol: 'Bs' },
];

// ─── Página ───────────────────────────────────────────────────────────────────

const InventoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedCurrency, setSelectedCurrency] = useState(null);

  // ── Filtros del kardex ─────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [movType, setMovType]     = useState('');
  const [movPage, setMovPage]     = useState(1);
  const [movLimit, setMovLimit]   = useTableLimit();

  const handleDateChange = (range) => { setDateRange(range); setMovPage(1); };
  const handleTypeChange = (val)   => { setMovType(val);     setMovPage(1); };

  // ── Detalle de inventario ──────────────────────────────────────────────────
  const {
    data: inventory,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['inventory-detail', id],
    queryFn: () => inventoryService.getById(id).then(r => r.data),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    onSuccess: (data) => {
      const pres = data?.product?.presentations?.[0];
      if (pres?.purchase_currency && !selectedCurrency) {
        setSelectedCurrency(pres.purchase_currency);
      }
    },
  });

  // ── Historial de movimientos (Kardex) ─────────────────────────────────────
  // Se cargan todos para que el balance corriente sea siempre exacto,
  // sin importar el filtro de fechas o tipo activo.
  const { data: movementsRaw = [], isLoading: loadingMovements } = useQuery({
    queryKey: ['inventory-movements', inventory?.product_id],
    queryFn: () =>
      inventoryService.getMovements({ product_id: inventory.product_id, limit: 9999 })
        .then(r => r.data || r),
    enabled: !!inventory?.product_id,
    staleTime: 60_000,
  });

  // ── Balance corriente ──────────────────────────────────────────────────────
  // 1. Ordenar de más antiguo a más nuevo
  // 2. Calcular saldo acumulado
  // 3. Invertir (más nuevo primero)
  // 4. Filtrar por fecha y tipo
  // 5. Paginar
  const { allKardex, filteredKardex, pagedKardex, totalMovPages } = (() => {
    if (!movementsRaw.length) {
      return { allKardex: [], filteredKardex: [], pagedKardex: [], totalMovPages: 1 };
    }

    const sorted = [...movementsRaw].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    let balance = 0;
    const withBalance = sorted.map(m => {
      const qty      = parseFloat(m.quantity) || 0;
      const positive = isPositiveMovement(m.movement_type);
      balance        = positive ? balance + qty : balance - qty;
      return { ...m, qty, positive, balance };
    });

    const all = withBalance.reverse();

    const dateFrom = dateRange.start_date ? new Date(`${dateRange.start_date}T00:00:00`) : null;
    const dateTo   = dateRange.end_date   ? new Date(`${dateRange.end_date}T23:59:59`)   : null;

    const filtered = all.filter(m => {
      const d = new Date(m.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      if (movType  && m.movement_type !== movType) return false;
      return true;
    });

    const pages    = Math.max(1, Math.ceil(filtered.length / movLimit));
    const safePage = Math.min(movPage, pages);
    const paged    = filtered.slice((safePage - 1) * movLimit, safePage * movLimit);

    return { allKardex: all, filteredKardex: filtered, pagedKardex: paged, totalMovPages: pages };
  })();

  // ── Conversión de moneda ───────────────────────────────────────────────────
  const defaultPresentation = inventory?.product?.presentations?.find(p => p.is_default)
    || inventory?.product?.presentations?.[0];
  const originalCurrency  = defaultPresentation?.purchase_currency || 'USD';
  const effectiveCurrency = selectedCurrency || originalCurrency;
  const needsConversion   = effectiveCurrency !== originalCurrency;

  const { data: conversionData } = useQuery({
    queryKey: ['currency-convert', defaultPresentation?.cost, originalCurrency, effectiveCurrency],
    queryFn: () =>
      exchangeRateService.convert(
        parseFloat(defaultPresentation.cost),
        originalCurrency,
        effectiveCurrency
      ).then(r => r.data),
    enabled: needsConversion && !!defaultPresentation?.cost,
    staleTime: 5 * 60_000,
  });

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Referencia', 'Entrada', 'Salida', 'Existencia', 'Motivo', 'Usuario'];
    const rows = filteredKardex.map(m => [
      new Date(m.created_at).toLocaleString('es-VE'),
      m.movement_type,
      m.document_number || '',
      m.positive ? m.qty : '',
      !m.positive ? m.qty : '',
      Math.max(0, Math.round(m.balance)),
      m.reason || '',
      m.user
        ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.trim() || m.user.username
        : 'Sistema',
    ]);
    const productName = inventory?.product?.name?.replace(/\s+/g, '_') || 'kardex';
    downloadCSV(`kardex_${productName}`, headers, rows);
  };

  // ─── Estados de carga/error ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner size="lg" />
        <p className="text-gray-500">Cargando detalles del inventario...</p>
      </div>
    );
  }

  if (isError || !inventory) {
    return (
      <div className="p-6">
        <Alert variant="error">
          {error?.response?.data?.message || 'Error al cargar detalles del inventario'}
        </Alert>
      </div>
    );
  }

  // ─── Helpers de stock ─────────────────────────────────────────────────────

  const totalUnits   = Math.floor(inventory.quantity);
  const unitsPerPkg  = defaultPresentation?.units_per_package || 1;
  const totalPackages = Math.floor(totalUnits / unitsPerPkg);
  const looseUnits   = totalUnits % unitsPerPkg;
  const reorderPoint = Math.floor(inventory.product.reorder_point || 0);

  const stockStatus = totalUnits === 0
    ? { label: 'Agotado', variant: 'error' }
    : totalUnits <= reorderPoint
    ? { label: 'Stock Bajo', variant: 'warning' }
    : { label: 'Normal', variant: 'success' };

  // ─── Costo ────────────────────────────────────────────────────────────────

  const costValue = (() => {
    const sym = CURRENCIES.find(c => c.code === effectiveCurrency)?.symbol || '$';
    if (!needsConversion || !conversionData) {
      const raw = parseFloat(defaultPresentation?.cost || 0);
      return `${sym} ${raw.toFixed(2)} ${originalCurrency}`;
    }
    if (conversionData.error) return 'Tasa no disponible';
    return `${sym} ${parseFloat(conversionData.converted_amount || 0).toFixed(2)} ${effectiveCurrency}`;
  })();

  // ─── Columnas del kardex ──────────────────────────────────────────────────

  const kardexColumns = [
    {
      header: 'Fecha',
      accessor: 'created_at',
      render: (_, m) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {new Date(m.created_at).toLocaleString('es-VE', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      header: 'Tipo',
      accessor: 'movement_type',
      render: (_, m) => <MovementTypeBadge type={m.movement_type} />,
    },
    {
      header: 'Referencia',
      accessor: 'document_number',
      render: (_, m) =>
        m.document_number
          ? <span className="text-xs font-mono text-gray-600">{m.document_number}</span>
          : <span className="text-xs text-gray-400">—</span>,
    },
    {
      header: 'Entrada',
      accessor: 'qty_in',
      cellClassName: 'text-right',
      render: (_, m) =>
        m.positive
          ? <span className="text-sm font-semibold text-green-600">+{m.qty}</span>
          : <span className="text-xs text-gray-300">—</span>,
    },
    {
      header: 'Salida',
      accessor: 'qty_out',
      cellClassName: 'text-right',
      render: (_, m) =>
        !m.positive
          ? <span className="text-sm font-semibold text-red-600">−{m.qty}</span>
          : <span className="text-xs text-gray-300">—</span>,
    },
    {
      header: 'Existencia',
      accessor: 'balance',
      cellClassName: 'text-right',
      render: (_, m) => (
        <span className="text-sm font-medium text-gray-900">
          {Math.max(0, Math.round(m.balance))}
        </span>
      ),
    },
    {
      header: 'Motivo / Usuario',
      accessor: 'reason',
      render: (_, m) => (
        <div className="text-xs">
          {m.reason && <div className="text-gray-600">{m.reason}</div>}
          <div className="text-gray-400 mt-0.5">
            {m.user
              ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.trim() || m.user.username
              : 'Sistema'}
          </div>
        </div>
      ),
    },
  ];

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/inventario')}
          className="mb-4 -ml-2 text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Inventario
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{inventory.product.name}</h1>
            <p className="text-gray-500 mt-0.5">SKU: {inventory.product.sku}</p>
          </div>
          <Button onClick={() => navigate(`/inventario/${id}/adjust`)}>
            <PencilSimple className="w-4 h-4" />
            Ajustar Stock
          </Button>
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card variant="compact" className="text-center">
          <Package className="w-8 h-8 text-blue-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-1">Stock Actual</p>
          <p className="text-3xl font-bold text-blue-600">{totalUnits}</p>
          <p className="text-xs text-blue-700 mt-1 font-medium">
            {totalPackages} pqt + {looseUnits} uds sueltas
          </p>
          <div className="mt-2">
            <Badge variant={stockStatus.variant}>{stockStatus.label}</Badge>
          </div>
        </Card>

        <Card variant="compact" className="text-center">
          <CurrencyDollar className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-1">Costo Unitario</p>
          <p className="text-xl font-bold text-green-600">{costValue}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <select
              value={effectiveCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-green-500 bg-white"
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>
        </Card>

        <Card variant="compact" className="text-center">
          <Warning className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-1">Punto de Reorden</p>
          <p className="text-3xl font-bold text-yellow-600">{reorderPoint}</p>
          <p className="text-xs text-gray-400 mt-1">unidades mínimas</p>
        </Card>
      </div>

      {/* Información del producto */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">Información del Producto</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Categoría</p>
            <p className="font-medium text-gray-900">{inventory.product.category?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Marca</p>
            <p className="font-medium text-gray-900">{inventory.product.brand?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Tamaño</p>
            <p className="font-medium text-gray-900">
              {inventory.product.unit_size
                ? `${parseFloat(inventory.product.unit_size)} ${inventory.product.unit_size_measure || 'UND'}`
                : inventory.product.unit_size_measure || 'UND'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Almacén</p>
            <p className="font-medium text-gray-900 flex items-center gap-1">
              <Warehouse className="w-3.5 h-3.5 text-gray-400" />
              {inventory.warehouse?.name || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Última actualización</p>
            <p className="font-medium text-gray-900 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              {new Date(inventory.updated_at).toLocaleString('es-VE')}
            </p>
          </div>
        </div>
      </Card>

      {/* Presentaciones */}
      {inventory.product.presentations?.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" />
            Presentaciones
          </h2>
          <div className="space-y-3">
            {inventory.product.presentations.map((pres) => (
              <div
                key={pres.id}
                className={`p-4 rounded-lg border-2 ${
                  pres.is_default ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm">{pres.name}</p>
                  {pres.is_default && <Badge variant="primary">Predeterminada</Badge>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Uds/paquete:</span> {pres.units_per_package}
                  </div>
                  <div>
                    <span className="font-medium">Costo paquete:</span> ${parseFloat(pres.package_cost || 0).toFixed(2)} {pres.purchase_currency}
                  </div>
                  <div>
                    <span className="font-medium">Precio paquete:</span> ${parseFloat(pres.package_price || 0).toFixed(2)}
                  </div>
                  <div>
                    <span className="font-medium">Costo unitario:</span> ${parseFloat(pres.cost || 0).toFixed(2)}
                  </div>
                </div>
                {pres.barcode && (
                  <p className="text-xs text-gray-400 mt-1">Código: {pres.barcode}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Kardex de movimientos */}
      <Card variant="flat" className="overflow-hidden">
        {/* Header del kardex */}
        <div className="px-4 pt-4 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowsLeftRight className="w-4 h-4 text-gray-500" />
            <h2 className="text-base font-semibold text-gray-900">Kardex de Movimientos</h2>
            {filteredKardex.length > 0 && (
              <span className="text-xs text-gray-400">
                ({filteredKardex.length} movimientos)
              </span>
            )}
          </div>
          {filteredKardex.length > 0 && (
            <ExportCsvAction onClick={handleExportCSV} title="Exportar kardex" />
          )}
        </div>

        {/* Filtros */}
        <div className="px-4 pb-4 border-b border-gray-100">
          <div className="flex flex-wrap items-end gap-3">
            <DateRangeFilter
              startDate={dateRange.start_date}
              endDate={dateRange.end_date}
              onChange={handleDateChange}
              showPresets
            />
            <div className="w-44">
              <Select
                value={movType}
                onChange={(e) => handleTypeChange(e.target.value)}
                options={MOVEMENT_TYPE_OPTIONS}
              />
            </div>
          </div>
        </div>

        {/* Tabla */}
        {loadingMovements ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : allKardex.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">
            No hay movimientos registrados para este producto
          </p>
        ) : filteredKardex.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">
            No hay movimientos con los filtros activos
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {kardexColumns.map(col => (
                      <th
                        key={col.accessor}
                        className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                          col.cellClassName?.includes('text-right') ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedKardex.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      {kardexColumns.map(col => (
                        <td
                          key={col.accessor}
                          className={`px-4 py-3 ${col.cellClassName || ''}`}
                        >
                          {col.render(null, m)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={Math.min(movPage, totalMovPages)}
              totalPages={totalMovPages}
              total={filteredKardex.length}
              limit={movLimit}
              onPageChange={setMovPage}
              onLimitChange={(l) => { setMovLimit(l); setMovPage(1); }}
            />
          </>
        )}
      </Card>
    </div>
  );
};

export default InventoryDetailPage;
