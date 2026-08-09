import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { inventoryService } from '../services/api/inventoryService';
import { warehouseService } from '../services/api/warehouseService';
import { categoryService } from '../services/api/categoryService';
import {
  Package, Warning, Calendar, CurrencyDollar, Funnel,
  ArrowClockwise, Plus, Info, X, Warehouse,
  CheckCircle, CircleNotch, WarningCircle, ClipboardText, ArrowsLeftRight,
} from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { formatByCurrency, formatDateShort } from '../utils/formatUtils';
import { downloadCSV } from '../utils/csvUtils';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import {
  Alert, Badge, Button, Card, EmptyState, ExportCsvAction, Input,
  Modal, SearchInput, Select, Spinner, Table, ViewAction, AdjustAction,
} from '../components/ui';
import type { BadgeVariant, Column } from '../components/ui';
import { AdjustStockModal } from '../components/inventory/AdjustStockModal';
import type { InventoryItem, Category, ProductPresentation } from '../types/models';

interface PresentationWithCost extends ProductPresentation {
  package_cost?: number;
  purchase_currency?: string;
  is_active?: boolean;
}

interface InventoryRow extends InventoryItem {
  updated_at?: string;
  product: InventoryItem['product'] & {
    reorder_point?: number;
    category?: { id: number; name: string; color?: string } | null;
    presentations?: PresentationWithCost[];
  };
}

interface CountEdit {
  bultos?: string;
  unidades?: string;
  dirty?: boolean;
}

interface ValuationData {
  totalValue?: number;
  totalsByCurrency?: Record<string, number>;
  conversions?: { currency: string; rate: number; convertedAmount: number }[];
  warnings?: { message: string }[];
}

const InventoryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Filters ────────────────────────────────────────────────────────────────
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedCategory, setSelectedCategory]   = useState<string>('');
  const [searchTerm, setSearchTerm]               = useState<string>('');
  const [showFilters, setShowFilters]             = useState<boolean>(false);
  const [filters, setFilters] = useState<{ lowStock: boolean; expiring: boolean; outOfStock: boolean }>({ lowStock: false, expiring: false, outOfStock: false });
  const [showHelp, setShowHelp]                   = useState<boolean>(false);
  const [showCurrencyBreakdown, setShowCurrencyBreakdown] = useState<boolean>(false);

  // ── Quick Count ────────────────────────────────────────────────────────────
  const [quickCountMode, setQuickCountMode] = useState<boolean>(false);
  const [countEdits, setCountEdits]         = useState<Record<number, CountEdit>>({});
  const [saveStatus, setSaveStatus]         = useState<Record<number, string>>({});
  const countEditsRef = useRef<Record<number, CountEdit>>({});
  const timersRef     = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const inputRefs     = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Individual Adjust ──────────────────────────────────────────────────────
  const [adjustItem, setAdjustItem]   = useState<InventoryRow | null>(null);

  const currencies = [
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
    { code: 'COP', name: 'Peso Colombiano',      symbol: '$' },
    { code: 'VES', name: 'Bolívar Venezolano',   symbol: 'Bs' },
  ];

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', selectedWarehouse, searchTerm, selectedCategory, filters],
    queryFn: () => inventoryService.getByWarehouse(selectedWarehouse === 'all' ? 'all' : Number(selectedWarehouse), {
      search: searchTerm,
      category_id: selectedCategory ? Number(selectedCategory) : undefined,
      low_stock:   filters.lowStock,
      expiring:    filters.expiring,
      out_of_stock: filters.outOfStock,
      limit: 500,
    } as Record<string, unknown>),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll(),
    staleTime: Infinity,
  });
  const warehouses = warehousesData?.data || [];

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', 'active'],
    queryFn: async () => {
      // Solo activas: el inventario únicamente lista productos activos
      const res = await categoryService.getAll({ limit: 1000, is_active: true });
      return res?.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: Infinity,
  });
  const exchangeRates = ratesData?.data || [];

  // Los KPIs comparten los filtros de depósito y categoría con la tabla
  const scopeParams = {
    warehouse_id: selectedWarehouse === 'all' ? undefined : Number(selectedWarehouse),
    category_id: selectedCategory ? Number(selectedCategory) : undefined,
  };

  const { data: lowStockData } = useQuery({
    queryKey: ['lowStock', selectedWarehouse, selectedCategory],
    queryFn: () => inventoryService.getLowStock(scopeParams),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: expiringData } = useQuery({
    queryKey: ['expiring', selectedWarehouse, selectedCategory],
    queryFn: () => inventoryService.getExpiringProducts({ days: 30, ...scopeParams }),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: valuationData } = useQuery<{ data: ValuationData }>({
    queryKey: ['valuation', selectedWarehouse, selectedCategory],
    queryFn: () => inventoryService.getValuation(scopeParams),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatCOP = (val: number) =>
    new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(val));

  const toCOP = (amount: number, fromCurrency: string = 'USD'): number | null => {
    if (!amount || amount === 0) return 0;
    if (fromCurrency === 'COP') return amount;
    const rate = calculateEffectiveRate(fromCurrency, 'COP', exchangeRates);
    // Sin tasa disponible: null — el caller muestra el valor en su moneda real
    // en vez de etiquetar un monto USD como COP
    return rate ? amount * rate : null;
  };

  // Muestra en COP si hay tasa; si no, en la moneda original (sin mentir)
  const formatValueCOP = (amount: number, fromCurrency: string = 'USD'): string => {
    const cop = toCOP(amount, fromCurrency);
    if (cop !== null) return formatCOP(cop);
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: fromCurrency, maximumFractionDigits: 0 }).format(amount || 0);
  };

  const getDefaultPresentation = (item: InventoryRow): PresentationWithCost =>
    item.product.presentations?.find((p: PresentationWithCost) => p.is_default && p.is_active) ||
    item.product.presentations?.find((p: PresentationWithCost) => p.is_active) ||
    { id: -1, name: 'Default', units_per_package: 1, price: 0, is_default: true, package_cost: 0 };

  const getStockStatus = (quantity: number, reorderPoint: number): { text: string; variant: BadgeVariant } => {
    const qty = parseFloat(String(quantity));
    if (qty === 0) return { text: 'Agotado', variant: 'error' };
    if (qty <= parseFloat(String(reorderPoint))) return { text: 'Stock Bajo', variant: 'warning' };
    return { text: 'Normal', variant: 'success' };
  };

  const hasActiveFilters   = filters.lowStock || filters.expiring || filters.outOfStock;
  const activeFiltersCount = Object.values(filters).filter(Boolean).length;
  // Incluye también los selectores de arriba, para saber si "Limpiar" hace algo
  const hasAnyFilter = hasActiveFilters || !!selectedCategory || selectedWarehouse !== 'all' || !!searchTerm;

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedWarehouse('all');
    setSelectedCategory('');
    setFilters({ lowStock: false, expiring: false, outOfStock: false });
  };

  // ── Quick Count handlers ────────────────────────────────────────────────────
  const handleCountChange = (item: InventoryRow, field: 'bultos' | 'unidades', value: string) => {
    const id = item.id;
    if (!countEditsRef.current[id]) countEditsRef.current[id] = {};
    countEditsRef.current[id][field] = value;
    countEditsRef.current[id].dirty  = true;
    setCountEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value, dirty: true } }));
    setSaveStatus(prev => ({ ...prev, [id]: 'idle' }));
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => {
      saveCountEdit(item, countEditsRef.current[id] || {});
    }, 800);
  };

  const saveCountEdit = async (item: InventoryRow, edits: CountEdit) => {
    const pres       = getDefaultPresentation(item);
    const unitsPerPkg = parseFloat(String(pres.units_per_package)) || 1;
    const bultos     = parseFloat(String(edits.bultos))   || 0;
    const unidades   = parseFloat(String(edits.unidades)) || 0;
    const newTotal   = (bultos * unitsPerPkg) + unidades;
    const diff       = newTotal - parseFloat(String(item.quantity));
    if (diff === 0) {
      setSaveStatus(prev => ({ ...prev, [item.id]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [item.id]: 'idle' })), 2000);
      return;
    }
    setSaveStatus(prev => ({ ...prev, [item.id]: 'saving' }));
    try {
      await inventoryService.adjustInventory({
        product_id:   item.product_id,
        warehouse_id: item.warehouse_id,
        type:         diff > 0 ? 'add' : 'remove',
        loose_units:  Math.abs(diff),
        reason:       'Conteo Rápido',
      });
      setSaveStatus(prev => ({ ...prev, [item.id]: 'saved' }));
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [item.id]: 'idle' })), 2000);
    } catch {
      setSaveStatus(prev => ({ ...prev, [item.id]: 'error' }));
    }
  };

  const retrySave = (item: InventoryRow) => saveCountEdit(item, countEditsRef.current[item.id] || {});

  const handleExitQuickCount = () => {
    Object.values(timersRef.current).forEach(t => clearTimeout(t));
    timersRef.current   = {};
    countEditsRef.current = {};
    setCountEdits({});
    setSaveStatus({});
    setQuickCountMode(false);
  };

  // ── Individual Adjust ──────────────────────────────────────────────────────
  const openAdjust = (item: InventoryRow) => setAdjustItem(item);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleDownloadReport = () => {
    if (!inventoryData?.data?.length) {
      toast.error('No hay datos para exportar');
      return;
    }
    const timestamp     = new Date().toISOString().split('T')[0];
    const warehouseName = selectedWarehouse === 'all' ? 'todos' : `deposito-${selectedWarehouse}`;
    downloadCSV(
      `inventario-${warehouseName}-${timestamp}`,
      ['Producto', 'Categoría', 'Bultos', 'Unidades', 'Depósito', 'Estado'],
      (inventoryData.data as InventoryRow[]).map((item: InventoryRow) => {
        const pres        = getDefaultPresentation(item);
        const unitsPerPkg = parseFloat(String(pres.units_per_package)) || 1;
        const qty         = parseFloat(String(item.quantity));
        const status      = getStockStatus(qty, Number(item.product.reorder_point) || 0);
        return [
          item.product.name,
          item.product.category?.name || 'N/A',
          Math.floor(qty / unitsPerPkg),
          qty % unitsPerPkg,
          item.warehouse?.name || 'N/A',
          status.text,
        ];
      })
    );
  };

  // ── Columnas tabla normal ──────────────────────────────────────────────────
  const inventoryColumns: Column<InventoryRow>[] = [
    {
      header: 'Producto',
      accessor: 'product',
      render: (_: unknown, item: InventoryRow) => (
        <div>
          <div className="font-medium text-gray-900">{item.product.name}</div>
          {selectedWarehouse === 'all' && (
            <div className="text-xs text-gray-400">{item.warehouse?.name}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Categoría',
      accessor: 'category',
      render: (_: unknown, item: InventoryRow) => item.product.category ? (
        <span
          className="px-2 py-1 text-xs rounded-full text-white font-medium"
          style={{ backgroundColor: item.product.category.color || '#6B7280' }}
        >
          {item.product.category.name}
        </span>
      ) : (
        <Badge variant="neutral">N/A</Badge>
      ),
    },
    {
      header: 'Bultos',
      accessor: 'bultos',
      cellClassName: 'text-center',
      render: (_: unknown, item: InventoryRow) => {
        const pres = getDefaultPresentation(item);
        const qty  = parseFloat(String(item.quantity));
        return <span className="font-semibold text-gray-900">{Math.floor(qty / (parseFloat(String(pres.units_per_package)) || 1))}</span>;
      },
    },
    {
      header: 'Unidades',
      accessor: 'unidades',
      cellClassName: 'text-center',
      render: (_: unknown, item: InventoryRow) => {
        const pres = getDefaultPresentation(item);
        const qty  = parseFloat(String(item.quantity));
        return <span className="text-gray-600">{Math.round(qty % (parseFloat(String(pres.units_per_package)) || 1))}</span>;
      },
    },
    {
      header: 'Último Ajuste',
      accessor: 'updated_at',
      render: (_: unknown, item: InventoryRow) => (
        <span className="text-sm text-gray-500">
          {formatDateShort(item.updated_at)}
        </span>
      ),
    },
    {
      header: 'Valor Inventario',
      accessor: 'value',
      cellClassName: 'text-right',
      render: (_: unknown, item: InventoryRow) => {
        const pres       = getDefaultPresentation(item);
        const qty        = parseFloat(String(item.quantity));
        const pkgCost    = parseFloat(String(pres.package_cost || 0));
        const upu        = parseFloat(String(pres.units_per_package)) || 1;
        const rawValue   = qty * (pkgCost / upu);
        return <span className="font-medium text-gray-700">{rawValue > 0 ? formatValueCOP(rawValue, pres.purchase_currency || 'USD') : '—'}</span>;
      },
    },
    {
      header: 'Estado',
      accessor: 'status',
      render: (_: unknown, item: InventoryRow) => {
        const s = getStockStatus(parseFloat(String(item.quantity)), Number(item.product.reorder_point) || 0);
        return <Badge variant={s.variant}>{s.text}</Badge>;
      },
    },
    {
      header: 'Acciones',
      accessor: 'id',
      render: (_: unknown, item: InventoryRow) => (
        <div className="flex items-center gap-1">
          <ViewAction onClick={() => navigate(`/inventario/${item.id}`)} />
          <AdjustAction onClick={() => openAdjust(item)} />
        </div>
      ),
    },
  ];

  // ─── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="text-primary-600 hover:text-primary-800"
              title="Ayuda"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">Gestión y control de inventario por depósito</p>
        </div>
        <div className="flex items-center gap-3">
          {!quickCountMode ? (
            <Button
              className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 focus-visible:ring-amber-400"
              onClick={() => setQuickCountMode(true)}
            >
              <ClipboardText className="w-4 h-4" />
              Conteo Rápido
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleExitQuickCount}>
              <X className="w-4 h-4" />
              Salir del conteo
            </Button>
          )}
          <Button onClick={() => navigate('/productos?action=new')}>
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Banner Conteo Rápido */}
      {quickCountMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 flex items-center gap-3">
          <ClipboardText className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Modo Conteo Rápido activo.</span>
            {' '}Ingresa los nuevos valores de bultos y unidades por producto. Los cambios se guardan automáticamente 800ms después de escribir.
          </p>
        </div>
      )}

      {/* Panel de ayuda */}
      {showHelp && (
        <Card className="bg-primary-50 border-primary-200">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-primary-900 mb-2">¿Cómo funciona el inventario?</h3>
              <div className="text-sm text-primary-800 space-y-1.5">
                <p><strong>Bultos / Unidades:</strong> El stock se muestra como paquetes completos + unidades sueltas según la presentación por defecto del producto.</p>
                <p><strong>Conteo Rápido:</strong> Ajusta el stock de múltiples productos a la vez sin salir de la página. Los cambios se guardan automáticamente.</p>
                <p><strong>Ajuste individual:</strong> El botón de lápiz en cada fila abre un formulario para ajustar un producto específico.</p>
                <p><strong>Stock Bajo:</strong> Productos en o por debajo del punto de reorden configurado.</p>
                <p><strong>Valor Inventario:</strong> Costo estimado basado en el costo de compra de la presentación por defecto, convertido a COP.</p>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="mt-3 text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Cerrar ayuda
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          variant="compact"
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setFilters(f => ({ ...f, lowStock: !f.lowStock }))}
          title="Click para filtrar productos con stock bajo"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-red-600">{lowStockData?.data?.length || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Click para filtrar</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg shrink-0">
              <Warning className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card
          variant="compact"
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setFilters(f => ({ ...f, expiring: !f.expiring }))}
          title="Click para filtrar productos próximos a vencer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Por Vencer</p>
              <p className="text-2xl font-bold text-yellow-600">{expiringData?.data?.length || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Próximos 30 días</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg shrink-0">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card variant="compact">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-primary-600">{inventoryData?.pagination?.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">En inventario</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-lg shrink-0">
              <Package className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>

        <Card variant="compact">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-green-600">
                {formatValueCOP(Number(valuationData?.data?.totalValue || 0), 'USD')}
              </p>
              {valuationData?.data?.totalsByCurrency &&
                Object.entries(valuationData.data.totalsByCurrency).filter(([, v]) => Number(v) > 0).length > 1 && (
                <button
                  onClick={() => setShowCurrencyBreakdown(true)}
                  className="mt-1 text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
                >
                  <Info className="w-3 h-3" />
                  Ver desglose por moneda
                </button>
              )}
            </div>
            <div className="bg-green-100 p-3 rounded-lg shrink-0">
              <CurrencyDollar className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <Card variant="flat">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <SearchInput
              placeholder="Buscar por nombre o SKU..."
              value={searchTerm}
              onChange={setSearchTerm}
            />
          </div>

          <div className="w-full md:w-52">
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
              <Select
                className="pl-10"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="all">Todos los Depósitos</option>
                {warehouses.map((w: { id: number; name: string }) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="w-full md:w-52">
            <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="">Todas las Categorías</option>
              {categories.map((c: Category) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant={hasActiveFilters ? 'primary' : 'secondary'}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              title="Filtros rápidos"
              className="relative"
            >
              <Funnel className="w-4 h-4" />
              {hasActiveFilters && (
                <span className="absolute -top-1.5 -right-1.5 bg-white text-primary-600 text-xs w-4 h-4 rounded-full font-bold border border-primary-600 flex items-center justify-center leading-none">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <Button
              variant="secondary"
              size="icon"
              onClick={handleClearFilters}
              disabled={!hasAnyFilter}
              title="Limpiar filtros"
            >
              <ArrowClockwise className="w-4 h-4" />
            </Button>

            <ExportCsvAction onClick={handleDownloadReport} title="Exportar CSV" />
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4">
            {([
              { key: 'lowStock' as const,   label: 'Stock Bajo' },
              { key: 'expiring' as const,   label: 'Próximos a vencer' },
              { key: 'outOfStock' as const, label: 'Agotados' },
            ]).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters[key]}
                  onChange={(e) => setFilters(f => ({ ...f, [key]: e.target.checked }))}
                  className="rounded text-primary-600 focus:ring-primary-200"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        )}
      </Card>

      {/* Tabla */}
      {isLoading ? (
        <Card variant="flat" className="flex justify-center py-16">
          <Spinner size="lg" />
        </Card>
      ) : !inventoryData?.data?.length ? (
        <Card variant="flat">
          <EmptyState
            icon={Package as React.ComponentType<any>}
            title="No hay productos en el inventario"
            description="Comienza agregando productos para gestionar tu inventario"
            action={
              <Button onClick={() => navigate('/productos?action=new')}>
                <Plus className="w-4 h-4" />
                Crear Primer Producto
              </Button>
            }
          />
        </Card>
      ) : quickCountMode ? (
        /* ── Modo Conteo Rápido ─────────────────────────────────────────────── */
        <Card variant="flat" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Stock Actual (ref.)</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-primary-600 uppercase tracking-wider bg-primary-50/50">Bultos Nuevos</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-primary-600 uppercase tracking-wider bg-primary-50/50">Uds. Nuevas</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(inventoryData.data as InventoryRow[]).map((item: InventoryRow, index: number) => {
                  const pres       = getDefaultPresentation(item);
                  const upu        = parseFloat(String(pres.units_per_package)) || 1;
                  const qty        = parseFloat(String(item.quantity));
                  const bultos     = Math.floor(qty / upu);
                  const unidades   = Math.round(qty % upu);
                  const edit       = countEdits[item.id] || {};
                  const statusSave = saveStatus[item.id] || 'idle';
                  const nextItem   = (inventoryData.data as InventoryRow[])[index + 1];

                  return (
                    <tr key={item.id} className={edit.dirty ? 'bg-primary-50/40' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">{item.product.name}</div>
                        {selectedWarehouse === 'all' && (
                          <div className="text-xs text-gray-400">{item.warehouse?.name}</div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center text-sm text-gray-400">
                        {bultos} {bultos === 1 ? 'bulto' : 'bultos'} + {unidades} {unidades === 1 ? 'suelta' : 'sueltas'}
                      </td>
                      <td className="px-6 py-3 text-center bg-primary-50/20">
                        <input
                          type="number" min="0" step="1"
                          value={edit.bultos !== undefined ? edit.bultos : ''}
                          placeholder={String(bultos)}
                          onChange={(e) => handleCountChange(item, 'bultos', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') inputRefs.current[`${item.id}-unidades`]?.focus();
                          }}
                          ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current[`${item.id}-bultos`] = el; }}
                          className="w-20 px-2 py-1.5 text-center border border-primary-300 rounded focus:ring-2 focus:ring-primary-200 bg-white text-sm"
                        />
                      </td>
                      <td className="px-6 py-3 text-center bg-primary-50/20">
                        <input
                          type="number" min="0" step="1"
                          value={edit.unidades !== undefined ? edit.unidades : ''}
                          placeholder={String(unidades)}
                          onChange={(e) => handleCountChange(item, 'unidades', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && nextItem) inputRefs.current[`${nextItem.id}-bultos`]?.focus();
                          }}
                          ref={(el: HTMLInputElement | null) => { if (el) inputRefs.current[`${item.id}-unidades`] = el; }}
                          className="w-20 px-2 py-1.5 text-center border border-primary-300 rounded focus:ring-2 focus:ring-primary-200 bg-white text-sm"
                        />
                      </td>
                      <td className="px-6 py-3 text-center">
                        {statusSave === 'saving' && (
                          <span className="text-amber-600 text-xs flex items-center justify-center gap-1">
                            <CircleNotch className="w-3 h-3 animate-spin" /> guardando...
                          </span>
                        )}
                        {statusSave === 'saved' && (
                          <span className="text-green-600 text-xs flex items-center justify-center gap-1">
                            <CheckCircle className="w-3 h-3" /> guardado
                          </span>
                        )}
                        {statusSave === 'error' && (
                          <button
                            onClick={() => retrySave(item)}
                            className="text-red-600 text-xs flex items-center justify-center gap-1 hover:underline"
                          >
                            <WarningCircle className="w-3 h-3" /> Error — Reintentar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* ── Modo normal ─────────────────────────────────────────────────────── */
        <Card variant="flat" className="overflow-hidden">
          <Table
            columns={inventoryColumns}
            data={inventoryData.data as InventoryRow[]}
            emptyMessage="No hay productos en el inventario"
          />
        </Card>
      )}

      {/* Modal: Ajuste individual */}
      <AdjustStockModal item={adjustItem} onClose={() => setAdjustItem(null)} />

      {/* Modal: Desglose de moneda */}
      <Modal
        open={showCurrencyBreakdown}
        onClose={() => setShowCurrencyBreakdown(false)}
        title="Desglose por Moneda"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Convertido</p>
            <p className="text-3xl font-bold text-green-600">
              {formatValueCOP(Number(valuationData?.data?.totalValue || 0), 'USD')}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Valores por Moneda:</p>
            <div className="space-y-3">
              {valuationData?.data?.totalsByCurrency &&
                Object.entries(valuationData.data.totalsByCurrency)
                  .filter(([, value]) => Number(value) > 0)
                  .map(([currency, value]) => {
                    const currencyInfo = currencies.find(c => c.code === currency);
                    const conversion   = valuationData?.data?.conversions?.find((c: { currency: string }) => c.currency === currency);
                    return (
                      <Card key={currency} variant="flat">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-gray-900">{currencyInfo?.name}</span>
                          <span className="text-sm text-gray-500">{currency}</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">
                          {formatByCurrency(Number(value), currency)}
                        </p>
                        {conversion && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <ArrowsLeftRight className="w-3 h-3" />
                              <span>Tasa: 1 {currency} = ${conversion.rate.toFixed(6)} USD</span>
                            </div>
                            <p className="text-sm text-green-600 font-medium mt-1">
                              = ${conversion.convertedAmount.toFixed(2)} USD
                            </p>
                          </div>
                        )}
                      </Card>
                    );
                  })}
            </div>
          </div>

          {valuationData?.data?.warnings && valuationData.data.warnings.length > 0 && (
            <Alert variant="warning">
              <p className="font-semibold text-xs mb-1">Advertencias:</p>
              {valuationData.data.warnings.map((w: { message: string }, i: number) => (
                <p key={i} className="text-xs">{w.message}</p>
              ))}
            </Alert>
          )}

          <Button variant="secondary" className="w-full" onClick={() => setShowCurrencyBreakdown(false)}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default InventoryPage;
