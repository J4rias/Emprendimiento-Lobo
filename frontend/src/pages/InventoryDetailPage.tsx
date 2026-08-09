import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { BadgeVariant, Column } from '../components/ui';
import { MovementTypeBadge, isPositiveMovement, MOVEMENT_TYPE_OPTIONS } from '../components/inventory/MovementTypeBadge';
import { AdjustStockModal } from '../components/inventory/AdjustStockModal';
import { downloadCSV } from '../utils/csvUtils';
import { formatDate, formatUSD, formatByCurrency } from '../utils/formatUtils';
import type { InventoryItem, ProductPresentation } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'COP', symbol: 'COP$' },
  { code: 'VES', symbol: 'Bs' },
];

interface KardexMovement {
  id: number;
  created_at: string;
  movement_type: string;
  document_number?: string;
  quantity: string | number;
  reason?: string;
  user?: { first_name?: string; last_name?: string; username?: string };
  qty: number;
  positive: boolean;
  balance: number;
  [key: string]: unknown;
}

interface ConversionData {
  error?: string;
  converted_amount?: string | number;
  from: string;
  to: string;
  amount: number;
  result: number;
  rate: number;
}

// ─── Página ───────────────────────────────────────────────────────────────────

const InventoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  // ── Filtros del kardex ─────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState(getDefaultDateRange());
  const [movType, setMovType]     = useState('');
  const [movPage, setMovPage]     = useState(1);
  const [movLimit, setMovLimit]   = useTableLimit();

  const handleDateChange = (range: { start_date: string; end_date: string }) => { setDateRange(range); setMovPage(1); };
  const handleTypeChange = (val: string)   => { setMovType(val);     setMovPage(1); };

  // ── Detalle de inventario ──────────────────────────────────────────────────
  const {
    data: inventory,
    isLoading,
    isError,
    error,
  } = useQuery<InventoryItem | null>({
    queryKey: ['inventory-detail', id],
    queryFn: async () => {
      const r = await inventoryService.getById(Number(id));
      return r.data as InventoryItem;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  // Set currency on first load
  useState(() => {
    // This is a hack to replace onSuccess, but we'll just use a useEffect-like approach
  });

  // ── Historial de movimientos (Kardex) ─────────────────────────────────────
  // Se cargan todos para que el balance corriente sea siempre exacto,
  // sin importar el filtro de fechas o tipo activo.
  const { data: movementsRaw = [], isLoading: loadingMovements } = useQuery<Record<string, unknown>[]>({
    queryKey: ['inventory-movements', inventory?.product_id],
    queryFn: async () => {
      const r = await inventoryService.getMovements({ product_id: inventory!.product_id, limit: 9999 });
      return (r.data || r) as Record<string, unknown>[];
    },
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
      return { allKardex: [] as KardexMovement[], filteredKardex: [] as KardexMovement[], pagedKardex: [] as KardexMovement[], totalMovPages: 1 };
    }

    const sorted = [...movementsRaw].sort(
      (a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime()
    );

    let balance = 0;
    const withBalance: KardexMovement[] = sorted.map((m: Record<string, unknown>) => {
      const rawQty = parseFloat(m.quantity as string) || 0;
      // 'transferencia' persiste el signo en quantity (salida negativa, entrada positiva)
      const delta = m.movement_type === 'transferencia'
        ? rawQty
        : (isPositiveMovement(m.movement_type as string) ? rawQty : -rawQty);
      balance += delta;
      return { ...m, qty: Math.abs(rawQty), positive: delta >= 0, balance } as KardexMovement;
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
  const defaultPresentation = (inventory?.product?.presentations?.find((p: ProductPresentation) => p.is_default)
    || inventory?.product?.presentations?.[0]) as (ProductPresentation & { purchase_currency?: string, cost?: string | number }) | undefined;
  const originalCurrency  = defaultPresentation?.purchase_currency || 'USD';
  const effectiveCurrency = selectedCurrency || originalCurrency;
  const needsConversion   = effectiveCurrency !== originalCurrency;

  const { data: conversionData } = useQuery<ConversionData>({
    queryKey: ['currency-convert', defaultPresentation?.cost, originalCurrency, effectiveCurrency],
    queryFn: async () => {
      const r = await exchangeRateService.convert(
        parseFloat(String(defaultPresentation?.cost)),
        originalCurrency,
        effectiveCurrency
      );
      return r.data as ConversionData;
    },
    enabled: needsConversion && !!defaultPresentation?.cost,
    staleTime: 5 * 60_000,
  });

  // Sync currency on load
  if (inventory && !selectedCurrency) {
    const pres = inventory.product?.presentations?.[0] as (ProductPresentation & { purchase_currency?: string }) | undefined;
    if (pres?.purchase_currency) {
      setSelectedCurrency(pres.purchase_currency);
    }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Fecha', 'Tipo', 'Referencia', 'Entrada', 'Salida', 'Existencia', 'Motivo', 'Usuario'];
    const rows = filteredKardex.map(m => [
      formatDate(m.created_at),
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
    const err = error as any;
    return (
      <div className="p-6">
        <Alert variant="error">
          {err?.response?.data?.message || 'Error al cargar detalles del inventario'}
        </Alert>
      </div>
    );
  }

  // ─── Helpers de stock ─────────────────────────────────────────────────────

  const totalUnits   = Math.floor(Number(inventory.quantity));
  const unitsPerPkg  = defaultPresentation?.units_per_package || 1;
  const totalPackages = Math.floor(totalUnits / unitsPerPkg);
  const looseUnits   = totalUnits % unitsPerPkg;
  const reorderPoint = Math.floor(Number((inventory.product as any)?.reorder_point || 0));

  const stockStatus: { label: string; variant: BadgeVariant } = totalUnits === 0
    ? { label: 'Agotado', variant: 'error' }
    : totalUnits <= reorderPoint
    ? { label: 'Stock Bajo', variant: 'warning' }
    : { label: 'Normal', variant: 'success' };

  // ─── Costo ────────────────────────────────────────────────────────────────

  const costValue = (() => {
    // formatByCurrency ya incluye el prefijo de moneda ($ / COP / Bs) y los
    // decimales que corresponden — no se le agrega sufijo para no duplicarlo
    if (!needsConversion || !conversionData) {
      return formatByCurrency(parseFloat(String(defaultPresentation?.cost || 0)), originalCurrency);
    }
    if (conversionData.error) return 'Tasa no disponible';
    return formatByCurrency(parseFloat(String(conversionData.converted_amount || 0)), effectiveCurrency);
  })();

  // ─── Columnas del kardex ──────────────────────────────────────────────────

  const kardexColumns: Column<KardexMovement>[] = [
    {
      header: 'Fecha',
      accessor: 'created_at',
      render: (_: unknown, m: KardexMovement) => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatDate(m.created_at)}
        </span>
      ),
    },
    {
      header: 'Tipo',
      accessor: 'movement_type',
      render: (_: unknown, m: KardexMovement) => <MovementTypeBadge type={m.movement_type} />,
    },
    {
      header: 'Referencia',
      accessor: 'document_number',
      render: (_: unknown, m: KardexMovement) =>
        m.document_number
          ? <span className="text-xs font-mono text-gray-600">{m.document_number}</span>
          : <span className="text-xs text-gray-400">—</span>,
    },
    {
      header: 'Entrada',
      accessor: 'qty_in',
      cellClassName: 'text-right',
      render: (_: unknown, m: KardexMovement) =>
        m.positive
          ? <span className="text-sm font-semibold text-green-600">+{m.qty}</span>
          : <span className="text-xs text-gray-300">—</span>,
    },
    {
      header: 'Salida',
      accessor: 'qty_out',
      cellClassName: 'text-right',
      render: (_: unknown, m: KardexMovement) =>
        !m.positive
          ? <span className="text-sm font-semibold text-red-600">−{m.qty}</span>
          : <span className="text-xs text-gray-300">—</span>,
    },
    {
      header: 'Existencia',
      accessor: 'balance',
      cellClassName: 'text-right',
      render: (_: unknown, m: KardexMovement) => (
        <span className="text-sm font-medium text-gray-900">
          {Math.max(0, Math.round(m.balance))}
        </span>
      ),
    },
    {
      header: 'Motivo / Usuario',
      accessor: 'reason',
      render: (_: unknown, m: KardexMovement) => (
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
            <h1 className="text-2xl font-bold text-gray-900">{inventory.product!.name}</h1>
            <p className="text-gray-500 mt-0.5">SKU: {inventory.product!.sku}</p>
          </div>
          <Button onClick={() => setAdjustOpen(true)}>
            <PencilSimple className="w-4 h-4" />
            Ajustar Stock
          </Button>
          <AdjustStockModal
            item={adjustOpen ? inventory : null}
            onClose={() => setAdjustOpen(false)}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['inventory-detail', id] })}
          />
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card variant="compact" className="text-center">
          <Package className="w-8 h-8 text-primary-500 mx-auto mb-2" />
          <p className="text-xs text-gray-500 mb-1">Stock Actual</p>
          <p className="text-3xl font-bold text-primary-600">{totalUnits}</p>
          <p className="text-xs text-primary-700 mt-1 font-medium">
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
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-primary-200 bg-white"
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
            <p className="font-medium text-gray-900">{inventory.product!.category?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Marca</p>
            <p className="font-medium text-gray-900">{inventory.product!.brand?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Tamaño</p>
            <p className="font-medium text-gray-900">
              {(inventory.product as any)?.unit_size
                ? `${parseFloat((inventory.product as any).unit_size)} ${(inventory.product as any).unit_size_measure || 'UND'}`
                : (inventory.product as any)?.unit_size_measure || 'UND'}
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
              {formatDate((inventory as any).updated_at)}
            </p>
          </div>
        </div>
      </Card>

      {/* Presentaciones */}
      {inventory.product!.presentations && inventory.product!.presentations.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" />
            Presentaciones
          </h2>
          <div className="space-y-3">
            {inventory.product!.presentations!.map((pres: ProductPresentation) => {
              const presExt = pres as ProductPresentation & { [key: string]: unknown };
              return (
              <div
                key={pres.id}
                className={`p-4 rounded-lg border-2 ${
                  pres.is_default ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-sm">{pres.name}</p>
                  {pres.is_default && <Badge variant="info">Predeterminada</Badge>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Uds/paquete:</span> {pres.units_per_package}
                  </div>
                  <div>
                    <span className="font-medium">Costo paquete:</span> {formatByCurrency(Number(presExt.package_cost || 0), String(presExt.purchase_currency || 'USD'))}
                  </div>
                  <div>
                    <span className="font-medium">Precio paquete:</span> {formatUSD(Number(presExt.package_price || 0))}
                  </div>
                  <div>
                    <span className="font-medium">Costo unitario:</span> {formatByCurrency(Number(presExt.cost || 0), String(presExt.purchase_currency || 'USD'))}
                  </div>
                </div>
                {presExt.barcode ? (
                  <p className="text-xs text-gray-400 mt-1">Código: {String(presExt.barcode)}</p>
                ) : null}
              </div>
              );
            })}
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
                        key={col.accessor as string}
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
                          key={col.accessor as string}
                          className={`px-4 py-3 ${col.cellClassName || ''}`}
                        >
                          {col.render ? col.render(null, m) : null}
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
