import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import {
  ArrowLeft, Package, Calendar, CurrencyDollar, Warning,
  Warehouse, PencilSimple, ArrowsLeftRight, TrendUp, TrendDown, Minus
} from '@phosphor-icons/react';
import { Alert, Badge, Button, Card, Spinner } from '../components/ui';

// ─── Movement type helpers ────────────────────────────────────────────────────

const isPositiveMovement = (type) =>
  type?.includes('positivo') || type?.includes('ingreso') || type?.includes('entrada') ||
  ['compra', 'devolucion_cliente'].includes(type);

const MOVEMENT_LABELS = {
  compra: 'Compra',
  venta: 'Venta',
  ajuste_positivo: 'Ajuste +',
  ajuste_negativo: 'Ajuste −',
  devolucion_cliente: 'Dev. Cliente',
  devolucion_proveedor: 'Dev. Proveedor',
  transferencia_salida: 'Transfer. Salida',
  transferencia_entrada: 'Transfer. Entrada',
  egreso_venta: 'Egreso Venta',
  ingreso_compra: 'Ingreso Compra',
};

const getMovementLabel = (type) =>
  MOVEMENT_LABELS[type] || type?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'COP', symbol: 'COP$' },
  { code: 'VES', symbol: 'Bs' },
];

// ─── Page ────────────────────────────────────────────────────────────────────

const InventoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedCurrency, setSelectedCurrency] = useState(null); // null = use product's currency

  // --- Kardex filters & pagination ---
  const today         = new Date();
  const firstOfMonth  = new Date(today.getFullYear(), today.getMonth(), 1);
  const toISO         = (d) => d.toISOString().slice(0, 10);

  const [movDateFrom, setMovDateFrom]   = useState(toISO(firstOfMonth));
  const [movDateTo,   setMovDateTo]     = useState(toISO(today));
  const [movPage,     setMovPage]       = useState(1);
  const [movLimit,    setMovLimit]      = useState(10);

  // --- Inventory detail ---
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

  // --- Movement history (Kardex) ---
  // Fetch all movements (no limit) so the running balance is always accurate
  const { data: movementsRaw = [] } = useQuery({
    queryKey: ['inventory-movements', inventory?.product_id],
    queryFn: () =>
      inventoryService.getMovements({ product_id: inventory.product_id, limit: 9999 })
        .then(r => r.data || r),
    enabled: !!inventory?.product_id,
    staleTime: 60_000,
  });

  // Build Kardex: compute running balance on ALL movements (oldest→newest),
  // then filter by date range, then paginate — balance numbers stay correct
  // regardless of what the user filters or which page they're on.
  const { allKardex, filteredKardex, pagedKardex, totalMovPages } = (() => {
    if (!movementsRaw.length) return { allKardex: [], filteredKardex: [], pagedKardex: [], totalMovPages: 1 };

    const sorted = [...movementsRaw].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    let balance = 0;
    const withBalance = sorted.map(m => {
      const qty = parseFloat(m.quantity) || 0;
      const positive = isPositiveMovement(m.movement_type);
      balance = positive ? balance + qty : balance - qty;
      return { ...m, qty, positive, balance };
    });
    const all = withBalance.reverse(); // newest first

    // Date filtering (client-side, after balance computation)
    const dateFrom = movDateFrom ? new Date(movDateFrom + 'T00:00:00') : null;
    const dateTo   = movDateTo   ? new Date(movDateTo   + 'T23:59:59') : null;
    const filtered = all.filter(m => {
      const d = new Date(m.created_at);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo   && d > dateTo)   return false;
      return true;
    });

    const pages  = Math.max(1, Math.ceil(filtered.length / movLimit));
    const safePage = Math.min(movPage, pages);
    const paged  = filtered.slice((safePage - 1) * movLimit, safePage * movLimit);

    return { allKardex: all, filteredKardex: filtered, pagedKardex: paged, totalMovPages: pages };
  })();

  // --- Currency conversion ---
  const defaultPresentation = inventory?.product?.presentations?.find(p => p.is_default)
    || inventory?.product?.presentations?.[0];
  const originalCurrency = defaultPresentation?.purchase_currency || 'USD';
  const effectiveCurrency = selectedCurrency || originalCurrency;
  const needsConversion = effectiveCurrency !== originalCurrency;

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

  // ─── Render states ────────────────────────────────────────────────────────

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

  // ─── Stock helpers ────────────────────────────────────────────────────────
  const totalUnits = Math.floor(inventory.quantity);
  const unitsPerPkg = defaultPresentation?.units_per_package || 1;
  const totalPackages = Math.floor(totalUnits / unitsPerPkg);
  const looseUnits = totalUnits % unitsPerPkg;
  const reorderPoint = Math.floor(inventory.product.reorder_point || 0);

  const stockStatus = totalUnits === 0
    ? { label: 'Agotado', variant: 'error' }
    : totalUnits <= reorderPoint
    ? { label: 'Stock Bajo', variant: 'warning' }
    : { label: 'Normal', variant: 'success' };

  // ─── Cost display ─────────────────────────────────────────────────────────
  const costValue = (() => {
    const sym = CURRENCIES.find(c => c.code === effectiveCurrency)?.symbol || '$';
    if (!needsConversion || !conversionData) {
      const raw = parseFloat(defaultPresentation?.cost || 0);
      return `${sym} ${raw.toFixed(2)} ${originalCurrency}`;
    }
    if (conversionData.error) return 'Tasa no disponible';
    return `${sym} ${parseFloat(conversionData.converted_amount || 0).toFixed(2)} ${effectiveCurrency}`;
  })();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
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

      {/* Stock summary cards */}
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

      {/* Product info */}
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

      {/* Presentations */}
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
      <Card>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ArrowsLeftRight className="w-4 h-4 text-gray-500" />
            Kardex de Movimientos
          </h2>
          <span className="text-xs text-gray-400">
            {filteredKardex.length} movimientos
          </span>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-end gap-3 mb-4 pb-4 border-b border-gray-100">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Desde</label>
            <input
              type="date"
              value={movDateFrom}
              onChange={e => { setMovDateFrom(e.target.value); setMovPage(1); }}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Hasta</label>
            <input
              type="date"
              value={movDateTo}
              onChange={e => { setMovDateTo(e.target.value); setMovPage(1); }}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Por página</label>
            <select
              value={movLimit}
              onChange={e => { setMovLimit(Number(e.target.value)); setMovPage(1); }}
              className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          {(movDateFrom || movDateTo) && (
            <button
              onClick={() => { setMovDateFrom(''); setMovDateTo(''); setMovPage(1); }}
              className="px-3 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Limpiar fechas
            </button>
          )}
        </div>

        {allKardex.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            No hay movimientos registrados para este producto
          </p>
        ) : filteredKardex.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            No hay movimientos en el rango de fechas seleccionado
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Existencia</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Motivo</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pagedKardex.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(m.created_at).toLocaleString('es-VE', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {m.positive
                            ? <TrendUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            : <TrendDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          }
                          <span className="text-xs font-medium text-gray-700">
                            {getMovementLabel(m.movement_type)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-sm font-semibold ${m.positive ? 'text-green-600' : 'text-red-600'}`}>
                          {m.positive ? '+' : '−'}{m.qty}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {Math.max(0, Math.round(m.balance))}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">
                        {m.reason || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {m.user
                          ? `${m.user.first_name || ''} ${m.user.last_name || ''}`.trim() || m.user.username
                          : 'Sistema'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalMovPages > 1 && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Mostrando {((movPage - 1) * movLimit) + 1}–{Math.min(movPage * movLimit, filteredKardex.length)} de {filteredKardex.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMovPage(1)}
                    disabled={movPage === 1}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setMovPage(p => Math.max(1, p - 1))}
                    disabled={movPage === 1}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    ‹
                  </button>

                  {/* Page numbers — show up to 5 around current page */}
                  {Array.from({ length: totalMovPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalMovPages || Math.abs(p - movPage) <= 2)
                    .reduce((acc, p, i, arr) => {
                      if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === '…' ? (
                        <span key={`ellipsis-${i}`} className="px-1.5 py-1 text-xs text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setMovPage(p)}
                          className={`px-2.5 py-1 text-xs border rounded ${
                            p === movPage
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )
                  }

                  <button
                    onClick={() => setMovPage(p => Math.min(totalMovPages, p + 1))}
                    disabled={movPage === totalMovPages}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setMovPage(totalMovPages)}
                    disabled={movPage === totalMovPages}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default InventoryDetailPage;
