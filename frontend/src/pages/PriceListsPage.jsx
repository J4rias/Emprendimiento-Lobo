import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { priceListService } from '../services/api/priceListService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import Modal from '../components/common/Modal';
import {
    Tags, Plus, Search, Edit, Trash2, Copy, Download,
    CheckCircle, AlertCircle, Clock, X, Save, Percent,
    Package, Printer, ChevronLeft, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const PriceListsPage = () => {
    const { hasPermission } = useAuth();

    // List state
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({});

    // Editor state
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingList, setEditingList] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        currency: 'USD',
        basePercentage: 0,
        isDefault: false,
        validity_days: 5
    });
    const [details, setDetails] = useState([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [exchangeRates, setExchangeRates] = useState([]);

    // Delete modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const printRef = useRef();

    useEffect(() => {
        fetchLists();
        loadExchangeRates();
    }, [searchTerm, statusFilter, page]);

    const loadExchangeRates = async () => {
        try {
            const res = await exchangeRateService.getLatest();
            setExchangeRates(res.data || []);
        } catch (err) {
            console.error('Error loading rates:', err);
        }
    };

    const fetchLists = async () => {
        try {
            setLoading(true);
            const res = await priceListService.getAll({
                search: searchTerm,
                status: statusFilter,
                page,
                limit: 20
            });
            setLists(res.data || []);
            setPagination(res.pagination || {});
        } catch (err) {
            toast.error('Error al cargar listas de precios');
        } finally {
            setLoading(false);
        }
    };

    // ===================== STATUS HELPERS =====================
    const getListStatus = (list) => {
        if (list.status === 'inactive') return 'inactive';
        if (!list.validUntil) return 'active';
        const now = new Date();
        const until = new Date(list.validUntil);
        if (now > until) return 'expired';
        // "Por vencer" = last 20% of validity
        const from = new Date(list.validFrom);
        const totalMs = until - from;
        const warningThreshold = totalMs * 0.2;
        const remaining = until - now;
        if (remaining <= warningThreshold) return 'expiring';
        return 'active';
    };

    const statusBadge = (list) => {
        const s = getListStatus(list);
        const map = {
            active: { bg: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3" />, label: 'Vigente' },
            expiring: { bg: 'bg-amber-100 text-amber-800', icon: <Clock className="w-3 h-3" />, label: 'Por vencer' },
            expired: { bg: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-3 h-3" />, label: 'Vencida' },
            inactive: { bg: 'bg-gray-100 text-gray-600', icon: <X className="w-3 h-3" />, label: 'Inactiva' }
        };
        const info = map[s];
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${info.bg}`}>
                {info.icon} {info.label}
            </span>
        );
    };

    const formatDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // ===================== EDITOR =====================
    const openEditor = async (list = null) => {
        setLoadingProducts(true);
        try {
            // 1. Fetch current stock products (always needed to see new items)
            const stockRes = await priceListService.getProductsWithStock();
            const stockProducts = stockRes.data || [];

            if (list) {
                // 2. Fetch existing list details
                const res = await priceListService.getById(list.id);
                const data = res.data;
                setEditingList(data);
                setFormData({
                    name: data.name,
                    description: data.description || '',
                    currency: data.currency,
                    basePercentage: parseFloat(data.basePercentage) || 0,
                    isDefault: data.isDefault,
                    validity_days: data.validity_days || 5
                });

                const existingDetailsMap = new Map();
                (data.details || []).forEach(d => {
                    existingDetailsMap.set(`${d.product_id}-${d.presentation_id}`, d);
                });

                const stockKeys = new Set(stockProducts.map(i => `${i.product_id}-${i.presentation.id}`));

                // Build merged list starting with current stock items
                const mergedDetails = stockProducts.map(item => {
                    const key = `${item.product_id}-${item.presentation.id}`;
                    const existing = existingDetailsMap.get(key);

                    const currentPkgCost = parseFloat(item.presentation.package_cost) || 0;
                    const currentUnitCost = parseFloat(item.presentation.cost) || 0;

                    if (existing) {
                        // Keep price from list, but update cost to current system value
                        const pkgPrice = parseFloat(existing.package_price) || 0;
                        const margin = currentPkgCost > 0 ? ((pkgPrice - currentPkgCost) / currentPkgCost * 100) : 0;

                        return {
                            product_id: existing.product_id,
                            presentation_id: existing.presentation_id,
                            product_name: existing.product?.name || '',
                            product_sku: existing.product?.sku || '',
                            presentation_name: existing.presentation?.name || '',
                            units_per_package: existing.presentation?.units_per_package || 1,
                            package_cost: currentPkgCost,
                            unit_cost: currentUnitCost,
                            package_price: pkgPrice,
                            unit_price: parseFloat(existing.unit_price) || 0,
                            margin_percentage: Math.round(margin * 10000) / 10000,
                            base_currency: 'USD',
                            native_currency: item.presentation?.purchase_currency || 'USD'
                        };
                    } else {
                        // New product with stock that wasn't in the list
                        return {
                            product_id: item.product_id,
                            presentation_id: item.presentation.id,
                            product_name: item.product?.name || '',
                            product_sku: item.product?.sku || '',
                            presentation_name: item.presentation?.name || '',
                            units_per_package: item.presentation?.units_per_package || 1,
                            package_cost: currentPkgCost,
                            unit_cost: currentUnitCost,
                            package_price: 0,
                            unit_price: 0,
                            margin_percentage: 0,
                            base_currency: 'USD',
                            native_currency: item.presentation?.purchase_currency || 'USD'
                        };
                    }
                });

                // Add items that were in the list but are NOT currently in stock
                (data.details || []).forEach(d => {
                    const key = `${d.product_id}-${d.presentation_id}`;
                    if (!stockKeys.has(key)) {
                        mergedDetails.push({
                            product_id: d.product_id,
                            presentation_id: d.presentation_id,
                            product_name: d.product?.name || '',
                            product_sku: d.product?.sku || '',
                            presentation_name: d.presentation?.name || '',
                            units_per_package: d.presentation?.units_per_package || 1,
                            package_cost: parseFloat(d.presentation?.package_cost || d.package_cost) || 0,
                            unit_cost: parseFloat(d.presentation?.cost || d.unit_cost) || 0,
                            package_price: parseFloat(d.package_price) || 0,
                            unit_price: parseFloat(d.unit_price) || 0,
                            margin_percentage: parseFloat(d.margin_percentage) || 0,
                            base_currency: 'USD',
                            native_currency: d.presentation?.purchase_currency || 'USD'
                        });
                    }
                });

                setDetails(mergedDetails);
            } else {
                // New list logic: use all current stock products
                setEditingList(null);
                setFormData({
                    name: '',
                    description: '',
                    currency: 'USD',
                    basePercentage: 0,
                    isDefault: false,
                    validity_days: 5
                });
                setDetails(stockProducts.map(item => ({
                    product_id: item.product_id,
                    presentation_id: item.presentation.id,
                    product_name: item.product?.name || '',
                    product_sku: item.product?.sku || '',
                    presentation_name: item.presentation?.name || '',
                    units_per_package: item.presentation?.units_per_package || 1,
                    package_cost: parseFloat(item.presentation.package_cost) || 0,
                    unit_cost: parseFloat(item.presentation.cost) || 0,
                    package_price: 0,
                    unit_price: 0,
                    margin_percentage: 0,
                    base_currency: 'USD',
                    native_currency: item.presentation?.purchase_currency || 'USD'
                })));
            }
        } catch (err) {
            console.error('Error opening editor:', err);
            toast.error('Error al cargar la lista y productos');
        } finally {
            setLoadingProducts(false);
            setDetailSearch('');
            setEditorOpen(true);
        }
    };

    const closeEditor = () => {
        setEditorOpen(false);
        setEditingList(null);
        setDetails([]);
        setDetailSearch('');
    };

    const applyGeneralMargin = () => {
        const pct = parseFloat(formData.basePercentage) || 0;
        setDetails(prev => prev.map(d => {
            const pkgCost = d.package_cost;
            const pkgPrice = pkgCost > 0 ? pkgCost * (1 + pct / 100) : 0;
            const unitPrice = d.units_per_package > 0 ? pkgPrice / d.units_per_package : 0;
            return {
                ...d,
                package_price: Math.round(pkgPrice * 1000000) / 1000000,
                unit_price: Math.round(unitPrice * 1000000) / 1000000,
                margin_percentage: Math.round(pct * 10000) / 10000,
                package_price_cop_str: undefined
            };
        }));
        toast.success(`Margen del ${pct}% aplicado a todos los productos`);
    };

    const updateDetailPrice = (index, field, value) => {
        setDetails(prev => {
            const updated = [...prev];
            const item = { ...updated[index] };
            const numVal = parseFloat(value) || 0;

            if (field === 'package_price') {
                item.package_price = numVal;
                item.package_price_cop_str = undefined;
                item.unit_price = item.units_per_package > 0
                    ? Math.round((numVal / item.units_per_package) * 1000000) / 1000000
                    : 0;
                item.margin_percentage = item.package_cost > 0
                    ? Math.round(((numVal - item.package_cost) / item.package_cost * 100) * 10000) / 10000
                    : 0;
            } else if (field === 'package_price_cop') {
                item.package_price_cop_str = value;
                const rate = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
                const usdVal = numVal / rate;
                item.package_price = Math.round(usdVal * 1000000) / 1000000;
                item.unit_price = item.units_per_package > 0
                    ? Math.round((usdVal / item.units_per_package) * 1000000) / 1000000
                    : 0;
                item.margin_percentage = item.package_cost > 0
                    ? Math.round(((usdVal - item.package_cost) / item.package_cost * 100) * 10000) / 10000
                    : 0;
            } else if (field === 'margin_percentage') {
                item.margin_percentage = numVal;
                item.package_price_cop_str = undefined;
                item.package_price = item.package_cost > 0
                    ? Math.round(item.package_cost * (1 + numVal / 100) * 1000000) / 1000000
                    : 0;
                item.unit_price = item.units_per_package > 0
                    ? Math.round((item.package_price / item.units_per_package) * 1000000) / 1000000
                    : 0;
            }

            updated[index] = item;
            return updated;
        });
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('El nombre de la lista es obligatorio');
            return;
        }
        try {
            setSaving(true);
            const payload = {
                ...formData,
                renewValidity: true,
                details: details.map(d => ({
                    product_id: d.product_id,
                    presentation_id: d.presentation_id,
                    package_cost: d.package_cost,
                    unit_cost: d.unit_cost,
                    package_price: d.package_price,
                    unit_price: d.unit_price,
                    margin_percentage: d.margin_percentage
                }))
            };

            if (editingList) {
                await priceListService.update(editingList.id, payload);
                toast.success('Lista actualizada exitosamente');
            } else {
                await priceListService.create(payload);
                toast.success('Lista creada exitosamente');
            }
            closeEditor();
            fetchLists();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error al guardar la lista');
        } finally {
            setSaving(false);
        }
    };

    const handleDuplicate = async (list) => {
        try {
            await priceListService.duplicate(list.id, `${list.name} (Copia)`);
            toast.success('Lista duplicada exitosamente');
            fetchLists();
        } catch {
            toast.error('Error al duplicar la lista');
        }
    };

    const handleDelete = async () => {
        try {
            await priceListService.delete(deletingId);
            toast.success('Lista eliminada');
            setShowDeleteModal(false);
            setDeletingId(null);
            fetchLists();
        } catch {
            toast.error('Error al eliminar la lista');
        }
    };

    const handleExportCSV = async (id) => {
        try {
            await priceListService.exportCSV(id);
            toast.success('CSV exportado');
        } catch {
            toast.error('Error al exportar');
        }
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
      <html><head><title>Lista de Precios - ${formData.name}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h1 { font-size: 18px; margin-bottom: 5px; }
        .meta { color: #666; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .text-right { text-align: right; }
      </style></head><body>
      ${content.innerHTML}
      </body></html>`);
        printWindow.document.close();
        printWindow.print();
    };

    // ===================== RENDER HELPER =====================
    const renderCostDisplay = (usdAmount, baseCurrency, isBold = false) => {
        if (baseCurrency !== 'USD') {
            const isCOP = baseCurrency === 'COP';
            const formatted = usdAmount.toLocaleString('de-DE', {
                minimumFractionDigits: isCOP ? 0 : 2,
                maximumFractionDigits: isCOP ? 0 : 2
            });
            return (
                <div className="flex flex-col items-end leading-tight">
                    <div className={`text-gray-900 ${isBold ? 'font-bold' : 'font-medium'}`}>
                        {isCOP ? `COP ${formatted}` : `${baseCurrency} ${formatted}`}
                    </div>
                </div>
            );
        }

        const rate = calculateEffectiveRate('USD', 'COP', exchangeRates);
        const usdFormatted = usdAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (!rate) {
            return (
                <div className="flex flex-col items-end leading-tight">
                    <div className={`text-gray-900 ${isBold ? 'font-bold' : 'font-medium'}`}>USD ${usdFormatted}</div>
                </div>
            );
        }

        const copConverted = usdAmount * rate;
        // Use 0 decimals for COP display
        const copFormatted = copConverted.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

        return (
            <div className="flex flex-col items-end leading-tight gap-0.5">
                <div className={`text-gray-900 ${isBold ? 'font-bold' : 'font-medium'}`}>COP {copFormatted}</div>
                <div className="text-gray-500 font-medium text-[11px]">USD ${usdFormatted}</div>
            </div>
        );
    };

    // ===================== FILTERED DETAILS =====================
    const filteredDetails = details.filter(d => {
        if (!detailSearch) return true;
        const q = detailSearch.toLowerCase();
        return (
            d.product_name.toLowerCase().includes(q) ||
            d.product_sku.toLowerCase().includes(q) ||
            d.presentation_name.toLowerCase().includes(q)
        );
    });

    // ===================== RENDER =====================
    if (editorOpen) {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={closeEditor} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                {editingList ? 'Editar Lista de Precios' : 'Nueva Lista de Precios'}
                            </h1>
                            {editingList && (
                                <span className="text-sm text-gray-500">{editingList.code}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {editingList && (
                            <>
                                <button onClick={handlePrint} className="btn-secondary flex items-center gap-2" title="Imprimir">
                                    <Printer className="w-4 h-4" /> Imprimir
                                </button>
                                <button onClick={() => handleExportCSV(editingList.id)} className="btn-secondary flex items-center gap-2" title="Exportar CSV">
                                    <Download className="w-4 h-4" /> CSV
                                </button>
                            </>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>

                {/* Form Header */}
                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Tags className="w-5 h-5 text-blue-600" /> Información General
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Nombre <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ej: Lista Público General"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vigencia (días)</label>
                            <input
                                type="number"
                                min="1"
                                value={formData.validity_days}
                                onChange={e => setFormData(p => ({ ...p, validity_days: parseInt(e.target.value) || 5 }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                            <input
                                type="text"
                                value={formData.description}
                                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Descripción breve..."
                            />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isDefault}
                                    onChange={e => setFormData(p => ({ ...p, isDefault: e.target.checked }))}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-700">Lista predeterminada</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Global Margin */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Percent className="w-5 h-5 text-blue-600" /> Margen de Ganancia General
                        </h2>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={formData.basePercentage}
                                onChange={e => setFormData(p => ({ ...p, basePercentage: parseFloat(e.target.value) || 0 }))}
                                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center"
                            />
                            <span className="text-gray-500">%</span>
                            <button
                                onClick={applyGeneralMargin}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" /> Aplicar a Todos
                            </button>
                        </div>
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="w-5 h-5 text-blue-600" /> Productos ({details.length})
                            </h2>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    value={detailSearch}
                                    onChange={e => setDetailSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                    placeholder="Buscar producto..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Printable area */}
                    <div ref={printRef}>
                        <div className="print-header" style={{ display: 'none' }}>
                            <h1>{formData.name}</h1>
                            <p className="meta">Vigencia: {formData.validity_days} días</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Producto</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Presentación</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Costo/Paquete</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Costo Unit.</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Precio/Paquete</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Precio Unit.</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Margen %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredDetails.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                                {details.length === 0
                                                    ? 'No hay productos con stock disponibles para esta lista.'
                                                    : 'No se encontraron productos que coincidan con la búsqueda.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDetails.map((d, idx) => {
                                            const realIdx = details.findIndex(x => x.presentation_id === d.presentation_id && x.product_id === d.product_id);
                                            return (
                                                <tr key={`${d.product_id}-${d.presentation_id}`} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <div className="font-medium text-gray-900">{d.product_name}</div>
                                                            <div className="text-xs text-gray-500">{d.product_sku}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-700">{d.presentation_name}</td>
                                                    <td className={`px-4 py-3 text-right ${d.native_currency === 'USD' ? 'bg-green-50' : ''}`}>
                                                        {renderCostDisplay(d.package_cost, d.base_currency, false)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {renderCostDisplay(d.unit_cost, d.base_currency, false)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {d.base_currency === 'USD' ? (
                                                                <>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-gray-500 font-medium text-xs">COP</span>
                                                                        <input
                                                                            type="number"
                                                                            step="100"
                                                                            min="0"
                                                                            value={d.package_price_cop_str !== undefined ? d.package_price_cop_str : (d.package_price ? Math.round(d.package_price * (calculateEffectiveRate('USD', 'COP', exchangeRates) || 1)) : '')}
                                                                            onChange={e => updateDetailPrice(realIdx, 'package_price_cop', e.target.value)}
                                                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                                                                        />
                                                                    </div>
                                                                    <div className="text-gray-500 font-medium text-[11px]">
                                                                        USD ${(d.package_price || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-gray-500 font-medium text-xs">{d.base_currency}</span>
                                                                        <input
                                                                            type="number"
                                                                            step={d.base_currency === 'COP' ? "100" : "0.01"}
                                                                            min="0"
                                                                            value={d.package_price || ''}
                                                                            onChange={e => updateDetailPrice(realIdx, 'package_price', e.target.value)}
                                                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {renderCostDisplay(d.unit_price, d.base_currency, true)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                value={d.margin_percentage || ''}
                                                                onChange={e => updateDetailPrice(realIdx, 'margin_percentage', e.target.value)}
                                                                className={`w-20 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent ${d.margin_percentage < 0 ? 'border-red-300 bg-red-50 text-red-700' :
                                                                    d.margin_percentage === 0 ? 'border-gray-300 text-gray-500' :
                                                                        'border-green-300 bg-green-50 text-green-700'
                                                                    }`}
                                                            />
                                                            <span className="text-gray-400 text-xs">%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ===================== LIST VIEW =====================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Listas de Precios</h1>
                    <p className="text-sm text-gray-500 mt-1">Administra perfiles de precios para el punto de venta</p>
                </div>
                {hasPermission('price_lists.create') && (
                    <button
                        onClick={() => openEditor()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" /> Nueva Lista
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Buscar por nombre, código..."
                        />
                    </div>
                    <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">Todos los estados</option>
                        <option value="active">Vigentes</option>
                        <option value="expired">Vencidas</option>
                        <option value="inactive">Inactivas</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Código</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nombre</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vigencia</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
                                        Cargando...
                                    </td>
                                </tr>
                            ) : lists.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        No hay listas de precios registradas
                                    </td>
                                </tr>
                            ) : (
                                lists.map(list => (
                                    <tr key={list.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm text-gray-600">{list.code}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-gray-900">{list.name}</span>
                                                {list.isDefault && (
                                                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                                                        Default
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">{statusBadge(list)}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {formatDate(list.validFrom)} → {formatDate(list.validUntil)}
                                            <div className="text-xs text-gray-400">{list.validity_days} días</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                {hasPermission('price_lists.update') && (
                                                    <button
                                                        onClick={() => openEditor(list)}
                                                        className="text-primary-600 hover:text-primary-900 mr-3"
                                                        title="Editar"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {hasPermission('price_lists.create') && (
                                                    <button
                                                        onClick={() => handleDuplicate(list)}
                                                        className="text-emerald-600 hover:text-emerald-900 mr-3"
                                                        title="Duplicar"
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleExportCSV(list.id)}
                                                    className="text-gray-600 hover:text-gray-900 mr-3"
                                                    title="Exportar CSV"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                {hasPermission('price_lists.delete') && (
                                                    <button
                                                        onClick={() => { setDeletingId(list.id); setShowDeleteModal(true); }}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                            Página {pagination.page} de {pagination.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="btn-secondary disabled:opacity-50"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="btn-secondary disabled:opacity-50"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <Modal
                    isOpen={showDeleteModal}
                    onClose={() => setShowDeleteModal(false)}
                    title="Eliminar Lista de Precios"
                    size="sm"
                >
                    <div className="space-y-4">
                        <div className="bg-red-50 border-l-4 border-red-400 p-4">
                            <div className="flex">
                                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                                <p className="ml-3 text-sm text-red-700">
                                    ¿Estás seguro? Esta lista dejará de estar disponible en el punto de venta.
                                </p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Eliminar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default PriceListsPage;
