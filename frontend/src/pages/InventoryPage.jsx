import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import { warehouseService } from '../services/api/warehouseService';
import { categoryService } from '../services/api/categoryService';
import {
  Package, AlertTriangle, Calendar, DollarSign, Search, Filter,
  Download, RefreshCw, Eye, Edit2, Plus, Info, X, Warehouse,
  CheckCircle, Loader2, AlertCircle, ClipboardList, ArrowRightLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../utils/formatUtils';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';

const InventoryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filter state
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ lowStock: false, expiring: false, outOfStock: false });
  const [showHelp, setShowHelp] = useState(false);
  const [showCurrencyBreakdown, setShowCurrencyBreakdown] = useState(false);

  // Quick count mode
  const [quickCountMode, setQuickCountMode] = useState(false);
  const [countEdits, setCountEdits] = useState({});
  const [saveStatus, setSaveStatus] = useState({});
  const countEditsRef = useRef({});
  const timersRef = useRef({});
  const inputRefs = useRef({});

  // Individual adjust modal
  const [adjustItem, setAdjustItem] = useState(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'add', bultos: '', unidades: '', reason: '' });
  const [adjusting, setAdjusting] = useState(false);

  const currencies = [
    { code: 'USD', name: 'Dólar Estadounidense', symbol: '$' },
    { code: 'COP', name: 'Peso Colombiano', symbol: '$' },
    { code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs' }
  ];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory', selectedWarehouse, debouncedSearchTerm, selectedCategory, filters],
    queryFn: () => inventoryService.getByWarehouse(selectedWarehouse, {
      search: debouncedSearchTerm,
      category_id: selectedCategory || undefined,
      low_stock: filters.lowStock,
      expiring: filters.expiring,
      out_of_stock: filters.outOfStock,
      limit: 500,
    }),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => warehouseService.getAll(),
    staleTime: Infinity
  });
  const warehouses = warehousesData?.data || [];

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoryService.getAll({ limit: 200 });
      return res?.data || [];
    },
    staleTime: Infinity
  });

  const { data: ratesData } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => exchangeRateService.getLatest(),
    staleTime: Infinity
  });
  const exchangeRates = ratesData?.data || [];

  const formatCOP = (val) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(val));

  const toCOP = (amount, fromCurrency = 'USD') => {
    if (!amount || amount === 0) return 0;
    if (fromCurrency === 'COP') return amount;
    const rate = calculateEffectiveRate(fromCurrency, 'COP', exchangeRates);
    return rate ? amount * rate : amount;
  };

  const { data: lowStockData } = useQuery({
    queryKey: ['lowStock'],
    queryFn: () => inventoryService.getLowStock(),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: expiringData } = useQuery({
    queryKey: ['expiring'],
    queryFn: () => inventoryService.getExpiringProducts({ days: 30 }),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: valuationData } = useQuery({
    queryKey: ['valuation', selectedWarehouse],
    queryFn: () => inventoryService.getValuation({ warehouse_id: selectedWarehouse === 'all' ? undefined : selectedWarehouse }),
    refetchOnWindowFocus: true,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const getDefaultPresentation = (item) => {
    return item.product.presentations?.find(p => p.is_default && p.is_active)
      || item.product.presentations?.find(p => p.is_active)
      || { units_per_package: 1, package_cost: 0 };
  };

  const getStockStatus = (quantity, reorderPoint) => {
    const qty = parseFloat(quantity);
    const point = parseFloat(reorderPoint);
    if (qty === 0) return { text: 'Agotado', className: 'px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full' };
    if (qty <= point) return { text: 'Stock Bajo', className: 'px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full' };
    return { text: 'Normal', className: 'px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full' };
  };

  // ── Quick Count ──
  const handleCountChange = (item, field, value) => {
    const id = item.id;
    if (!countEditsRef.current[id]) countEditsRef.current[id] = {};
    countEditsRef.current[id][field] = value;
    countEditsRef.current[id].dirty = true;

    setCountEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value, dirty: true } }));
    setSaveStatus(prev => ({ ...prev, [id]: 'idle' }));

    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => {
      saveCountEdit(item, countEditsRef.current[id] || {});
    }, 800);
  };

  const saveCountEdit = async (item, edits) => {
    const pres = getDefaultPresentation(item);
    const unitsPerPkg = parseFloat(pres.units_per_package) || 1;
    const bultos = parseFloat(edits.bultos) || 0;
    const unidades = parseFloat(edits.unidades) || 0;
    const newTotal = (bultos * unitsPerPkg) + unidades;
    const currentTotal = parseFloat(item.quantity);
    const diff = newTotal - currentTotal;

    if (diff === 0) {
      setSaveStatus(prev => ({ ...prev, [item.id]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [item.id]: 'idle' })), 2000);
      return;
    }

    setSaveStatus(prev => ({ ...prev, [item.id]: 'saving' }));
    try {
      await inventoryService.adjustInventory({
        product_id: item.product_id,
        warehouse_id: item.warehouse_id,
        type: diff > 0 ? 'add' : 'remove',
        loose_units: Math.abs(diff),
        reason: 'Conteo Rápido'
      });
      setSaveStatus(prev => ({ ...prev, [item.id]: 'saved' }));
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [item.id]: 'idle' })), 2000);
    } catch {
      setSaveStatus(prev => ({ ...prev, [item.id]: 'error' }));
    }
  };

  const retrySave = (item) => {
    saveCountEdit(item, countEditsRef.current[item.id] || {});
  };

  const handleExitQuickCount = () => {
    Object.values(timersRef.current).forEach(t => clearTimeout(t));
    timersRef.current = {};
    countEditsRef.current = {};
    setCountEdits({});
    setSaveStatus({});
    setQuickCountMode(false);
  };

  // ── Individual Adjust ──
  const openAdjust = (item) => {
    setAdjustItem(item);
    setAdjustForm({ type: 'add', bultos: '', unidades: '', reason: '' });
  };

  const handleSubmitAdjust = async (e) => {
    e.preventDefault();
    if (!adjustItem) return;
    const pres = getDefaultPresentation(adjustItem);
    const unitsPerPkg = parseFloat(pres.units_per_package) || 1;
    const bultos = parseFloat(adjustForm.bultos) || 0;
    const unidades = parseFloat(adjustForm.unidades) || 0;
    const total = (bultos * unitsPerPkg) + unidades;
    if (total <= 0) { alert('Ingresa al menos una cantidad'); return; }
    setAdjusting(true);
    try {
      await inventoryService.adjustInventory({
        product_id: adjustItem.product_id,
        warehouse_id: adjustItem.warehouse_id,
        type: adjustForm.type,
        presentation_id: pres.id || undefined,
        package_quantity: bultos || undefined,
        loose_units: unidades || undefined,
        reason: adjustForm.reason || undefined
      });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setAdjustItem(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Error al ajustar inventario');
    } finally {
      setAdjusting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!inventoryData?.data || inventoryData.data.length === 0) {
      alert('No hay datos para exportar');
      return;
    }
    const headers = ['Producto', 'Categoría', 'Bultos', 'Unidades', 'Depósito', 'Estado'];
    const rows = inventoryData.data.map(item => {
      const pres = getDefaultPresentation(item);
      const unitsPerPkg = parseFloat(pres.units_per_package) || 1;
      const qty = parseFloat(item.quantity);
      const status = getStockStatus(qty, item.product.reorder_point);
      return [
        item.product.name,
        item.product.category?.name || 'N/A',
        Math.floor(qty / unitsPerPkg),
        qty % unitsPerPkg,
        item.warehouse?.name || 'N/A',
        status.text
      ];
    });
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) return `"${cellStr.replace(/"/g, '""')}"`;
        return cellStr;
      }).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    const warehouseName = selectedWarehouse === 'all' ? 'todos' : `deposito-${selectedWarehouse}`;
    link.setAttribute('href', url);
    link.setAttribute('download', `inventario-${warehouseName}-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
            <button onClick={() => setShowHelp(!showHelp)} className="text-blue-600 hover:text-blue-800" title="Ayuda">
              <Info className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">Gestión y control de inventario por depósito</p>
        </div>
        <div className="flex items-center gap-3">
          {!quickCountMode ? (
            <button
              onClick={() => setQuickCountMode(true)}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2 font-medium"
            >
              <ClipboardList className="w-4 h-4" />
              Conteo Rápido
            </button>
          ) : (
            <button
              onClick={handleExitQuickCount}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2 font-medium"
            >
              <X className="w-4 h-4" />
              Salir del conteo
            </button>
          )}
          <button
            onClick={() => navigate('/productos?action=new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Quick Count Banner */}
      {quickCountMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-3 flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">Modo Conteo Rápido activo.</span>
            {' '}Ingresa los nuevos valores de bultos y unidades por producto. Los cambios se guardan automáticamente 800ms después de escribir.
          </div>
        </div>
      )}

      {/* Help Panel */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-2">¿Cómo funciona el inventario?</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p><strong>📦 Bultos / Unidades:</strong> El stock se muestra como paquetes completos + unidades sueltas según la presentación por defecto del producto.</p>
                <p><strong>📋 Conteo Rápido:</strong> Ajusta el stock de múltiples productos a la vez sin salir de la página. Los cambios se guardan automáticamente.</p>
                <p><strong>✏️ Ajuste individual:</strong> El botón de lápiz en cada fila abre un formulario para ajustar un producto específico.</p>
                <p><strong>⚠️ Stock Bajo:</strong> Productos en o por debajo del punto de reorden configurado.</p>
                <p><strong>💰 Valor Inventario:</strong> Costo estimado basado en el costo de compra de la presentación por defecto (en USD).</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium">
                Cerrar ayuda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setFilters({ ...filters, lowStock: !filters.lowStock })}
          title="Click para filtrar productos con stock bajo"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Bajo</p>
              <p className="text-2xl font-bold text-red-600">{lowStockData?.data?.length || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Click para filtrar</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setFilters({ ...filters, expiring: !filters.expiring })}
          title="Click para filtrar productos próximos a vencer"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Por Vencer</p>
              <p className="text-2xl font-bold text-yellow-600">{expiringData?.data?.length || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Próximos 30 días</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg flex-shrink-0">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-blue-600">{inventoryData?.pagination?.total || 0}</p>
              <p className="text-xs text-gray-500 mt-1">En inventario</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg flex-shrink-0">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCOP(toCOP(valuationData?.data?.totalValue || 0, 'USD'))}
              </p>
              {valuationData?.data?.totalsByCurrency && Object.entries(valuationData.data.totalsByCurrency).filter(([, value]) => value > 0).length > 1 && (
                <button
                  onClick={() => setShowCurrencyBreakdown(true)}
                  className="mt-1 text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
                >
                  <Info className="w-3 h-3" />
                  Ver desglose por moneda
                </button>
              )}
            </div>
            <div className="bg-green-100 p-3 rounded-lg flex-shrink-0">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="input pl-10"
                placeholder="Buscar por nombre o SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full md:w-52">
            <div className="relative">
              <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <select
                className="input pl-10 appearance-none"
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
              >
                <option value="all">Todos los Depósitos</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="w-full md:w-52">
            <select
              className="input appearance-none"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Todas las Categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${(filters.lowStock || filters.expiring || filters.outOfStock)
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              title="Filtros rápidos"
            >
              <Filter className="w-4 h-4" />
              {(filters.lowStock || filters.expiring || filters.outOfStock) && (
                <span className="bg-white text-blue-600 text-xs px-2 py-0.5 rounded-full font-bold">
                  {Object.keys(filters).filter(k => filters[k]).length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setSearchTerm(''); setSelectedWarehouse('all'); setSelectedCategory(''); setFilters({ lowStock: false, expiring: false, outOfStock: false }); }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
              title="Limpiar filtros"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleDownloadReport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center"
              title="Descargar reporte"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.lowStock} onChange={(e) => setFilters({ ...filters, lowStock: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Stock Bajo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.expiring} onChange={(e) => setFilters({ ...filters, expiring: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Próximos a vencer</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filters.outOfStock} onChange={(e) => setFilters({ ...filters, outOfStock: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-gray-700">Agotados</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600">Cargando inventario...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {quickCountMode ? (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Stock Actual (ref.)</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50/50">Bultos Nuevos</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider bg-blue-50/50">Uds. Nuevas</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Producto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Bultos</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Unidades</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Ajuste</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Inventario</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                    </tr>
                  )}
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventoryData?.data?.map((item, index) => {
                    const pres = getDefaultPresentation(item);
                    const unitsPerPkg = parseFloat(pres.units_per_package) || 1;
                    const qty = parseFloat(item.quantity);
                    const bultos = Math.floor(qty / unitsPerPkg);
                    const unidades = Math.round(qty % unitsPerPkg);
                    const status = getStockStatus(qty, item.product.reorder_point);
                    const pkgCost = parseFloat(pres.package_cost || 0);
                    const unitCost = pkgCost / unitsPerPkg;
                    const valueCOP = toCOP(qty * unitCost, pres.purchase_currency || 'USD');
                    const edit = countEdits[item.id] || {};
                    const statusSave = saveStatus[item.id] || 'idle';
                    const nextItem = inventoryData.data[index + 1];

                    if (quickCountMode) {
                      return (
                        <tr key={item.id} className={edit.dirty ? 'bg-blue-50/40' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-3">
                            <div className="text-sm font-medium text-gray-900">{item.product.name}</div>
                            {selectedWarehouse === 'all' && (
                              <div className="text-xs text-gray-400">{item.warehouse?.name}</div>
                            )}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <span className="text-sm text-gray-400">{bultos} bultos + {unidades} sueltas</span>
                          </td>
                          <td className="px-6 py-3 text-center bg-blue-50/20">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={edit.bultos !== undefined ? edit.bultos : ''}
                              placeholder={String(bultos)}
                              onChange={(e) => handleCountChange(item, 'bultos', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const next = inputRefs.current[`${item.id}-unidades`];
                                  if (next) next.focus();
                                }
                              }}
                              ref={(el) => { if (el) inputRefs.current[`${item.id}-bultos`] = el; }}
                              className="w-20 px-2 py-1.5 text-center border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                            />
                          </td>
                          <td className="px-6 py-3 text-center bg-blue-50/20">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={edit.unidades !== undefined ? edit.unidades : ''}
                              placeholder={String(unidades)}
                              onChange={(e) => handleCountChange(item, 'unidades', e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && nextItem) {
                                  const next = inputRefs.current[`${nextItem.id}-bultos`];
                                  if (next) next.focus();
                                }
                              }}
                              ref={(el) => { if (el) inputRefs.current[`${item.id}-unidades`] = el; }}
                              className="w-20 px-2 py-1.5 text-center border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                            />
                          </td>
                          <td className="px-6 py-3 text-center">
                            {statusSave === 'saving' && (
                              <span className="text-amber-600 text-xs flex items-center justify-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> guardando...
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
                                <AlertCircle className="w-3 h-3" /> Error — Reintentar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{item.product.name}</div>
                          {selectedWarehouse === 'all' && (
                            <div className="text-xs text-gray-400">{item.warehouse?.name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {item.product.category ? (
                            <span
                              className="px-2 py-1 text-xs rounded-full text-white font-medium inline-flex items-center gap-1.5"
                              style={{ backgroundColor: item.product.category.color || '#6B7280' }}
                            >
                              {item.product.category.name}
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm font-semibold text-gray-900">{bultos}</span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-gray-600">{unidades}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-500">
                            {item.updated_at ? new Date(item.updated_at).toLocaleDateString('es-CO') : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-medium text-gray-700">
                            {valueCOP > 0 ? formatCOP(valueCOP) : '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={status.className}>{status.text}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/inventario/${item.id}`)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Ver detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openAdjust(item)}
                              className="text-green-600 hover:text-green-800"
                              title="Ajustar stock"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!isLoading && (!inventoryData?.data || inventoryData.data.length === 0) && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No hay productos en el inventario</h3>
                <p className="text-gray-500 mb-4">Comienza agregando productos para gestionar tu inventario</p>
                <button
                  onClick={() => navigate('/productos?action=new')}
                  className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primer Producto
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Individual Adjust Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-sm shadow-xl">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Ajuste de Stock</h3>
                <p className="text-sm text-gray-500">{adjustItem.product.name}</p>
              </div>
              <button onClick={() => setAdjustItem(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitAdjust} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="add">➕ Entrada (agregar stock)</option>
                  <option value="remove">➖ Salida (retirar stock)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bultos</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustForm.bultos}
                    onChange={(e) => setAdjustForm({ ...adjustForm, bultos: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unidades sueltas</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={adjustForm.unidades}
                    onChange={(e) => setAdjustForm({ ...adjustForm, unidades: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-center"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
                <input
                  type="text"
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="Ej: Compra de proveedor, pérdida..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustItem(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {adjusting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : 'Guardar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Currency Breakdown Modal */}
      {showCurrencyBreakdown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Desglose por Moneda</h2>
                <button onClick={() => setShowCurrencyBreakdown(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Total Convertido</p>
                <p className="text-3xl font-bold text-green-600">
                  {formatCOP(toCOP(valuationData?.data?.totalValue || 0, 'USD'))}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">Valores por Moneda:</p>
                <div className="space-y-3">
                  {valuationData?.data?.totalsByCurrency && Object.entries(valuationData.data.totalsByCurrency)
                    .filter(([, value]) => value > 0)
                    .map(([currency, value]) => {
                      const currencyInfo = currencies.find(c => c.code === currency);
                      const conversion = valuationData.data.conversions?.find(c => c.currency === currency);
                      return (
                        <div key={currency} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-gray-900">{currencyInfo?.name}</span>
                            <span className="text-sm text-gray-500">{currency}</span>
                          </div>
                          <p className="text-lg font-bold text-gray-900">
                            {formatMoney(value, currencyInfo?.symbol)}
                          </p>
                          {conversion && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Tasa: 1 {currency} = ${conversion.rate.toFixed(6)} USD</span>
                              </div>
                              <p className="text-sm text-green-600 font-medium mt-1">
                                = ${conversion.convertedAmount.toFixed(2)} USD
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
              {valuationData?.data?.warnings && valuationData.data.warnings.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">Advertencias:</p>
                        {valuationData.data.warnings.map((warning, idx) => (
                          <p key={idx} className="text-xs text-yellow-700 mb-1">{warning.message}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setShowCurrencyBreakdown(false)}
                className="mt-6 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
