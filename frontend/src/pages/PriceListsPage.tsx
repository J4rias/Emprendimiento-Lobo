import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { priceListService } from '../services/api/priceListService';
import { exchangeRateService } from '../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { useAutoSave } from '../hooks/useAutoSave';
import {
    MagnifyingGlass, FileCsv,
    CheckCircle, WarningCircle, X,
    Package, Printer, Lock, LockOpen
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { LOCALE, formatCOP, formatUSD } from '../utils/formatUtils';
import { Button } from '../components/ui';

const PriceListsPage = () => {
    useAuth();

    // Editor state
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingList, setEditingList] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        currency: 'USD',
        isDefault: false,
        validity_days: 5
    });
    const [details, setDetails] = useState([]);
    const [detailSearch, setDetailSearch] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);

    const printRef = useRef();
    const editingListRef = useRef(null);

    // Query: exchange rates (static reference data)
    const { data: ratesData } = useQuery({
        queryKey: ['exchange-rates'],
        queryFn: () => exchangeRateService.getLatest(),
        staleTime: Infinity
    });
    const exchangeRates = ratesData?.data || [];

    // Auto-load LP-0013 al montar
    const [initialLoaded, setInitialLoaded] = useState(false);
    useEffect(() => {
        if (initialLoaded || !ratesData) return;
        setInitialLoaded(true);
        (async () => {
            try {
                const res = await priceListService.getAll({ search: 'LP-0013', limit: 1 });
                const list = (res.data || [])[0];
                if (list) {
                    openEditor(list);
                }
            } catch (err) {
                console.error('Error auto-loading LP-0013:', err);
                toast.error('Error al cargar la lista de precios');
            }
        })();
    }, [ratesData]);  

    // Auto-save: guarda un detail individual con debounce de 800ms (KEPT SEPARATE - DO NOT CONVERT)
    const autoSaveFn = useCallback(
        (data) => priceListService.updateDetail(editingListRef.current?.id, data),
        []
    );
    const autoSaveOnConflict = useCallback(() => {
        if (editingListRef.current) openEditor(editingListRef.current);  
    }, []);  

    const { save: autoSaveDetail, status: autoSaveStatus, errorKeys: autoSaveErrorKeys } = useAutoSave({
        saveFn: autoSaveFn,
        delay: 800,
        onConflict: autoSaveOnConflict,
    });

    // ===================== STATUS HELPERS =====================
    const getCostInUSD = (cost, currency) => {
        if (!cost) return 0;
        if (currency === 'USD') return parseFloat(cost);
        const rate = calculateEffectiveRate('USD', currency, exchangeRates) || 1;
        return parseFloat(cost) / rate;
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
                editingListRef.current = data;
                setFormData({
                    name: data.name,
                    description: data.description || '',
                    currency: data.currency,
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
                        const costUsd = getCostInUSD(currentPkgCost, item.presentation?.purchase_currency);
                        const margin = costUsd > 0 ? ((pkgPrice - costUsd) / costUsd * 100) : 0;

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
                            native_currency: item.presentation?.purchase_currency || 'USD',
                            is_frozen: existing.is_frozen || false,
                            frozen_price: existing.frozen_price ? parseFloat(existing.frozen_price) : null,
                            frozen_currency: existing.frozen_currency || 'USD',
                            package_price_usd: parseFloat(existing.package_price_usd) || 0
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
                            native_currency: item.presentation?.purchase_currency || 'USD',
                            package_price_usd: 0
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
                            native_currency: d.presentation?.purchase_currency || 'USD',
                            is_frozen: d.is_frozen || false,
                            frozen_price: d.frozen_price ? parseFloat(d.frozen_price) : null,
                            frozen_currency: d.frozen_currency || 'USD',
                            package_price_usd: parseFloat(d.package_price_usd) || 0
                        });
                    }
                });

                setDetails(mergedDetails);
            } else {
                // New list logic: use all current stock products
                setEditingList(null);
                editingListRef.current = null;
                setFormData({
                    name: '',
                    description: '',
                    currency: 'USD',
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
                    native_currency: item.presentation?.purchase_currency || 'USD',
                    is_frozen: false,
                    frozen_price: null,
                    frozen_currency: 'USD'
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

    const toggleFreeze = (index) => {
        const item = { ...details[index] };
        if (item.is_frozen) {
            item.is_frozen = false;
            item.frozen_price = null;
            item.frozen_currency = 'USD';
        } else {
            item.is_frozen = true;
            const rate = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
            const copPrice = Math.round(item.package_price * rate);
            item.frozen_price = copPrice;
            item.frozen_currency = 'COP';
            item.package_price = copPrice / rate;
        }

        setDetails(prev => {
            const updated = [...prev];
            updated[index] = item;
            return updated;
        });

        if (editingListRef.current) {
            const key = `${item.product_id}-${item.presentation_id}`;
            autoSaveDetail(key, {
                product_id: item.product_id,
                presentation_id: item.presentation_id,
                package_cost: item.package_cost,
                unit_cost: item.unit_cost,
                package_price: item.package_price,
                unit_price: item.unit_price,
                margin_percentage: item.margin_percentage,
                is_frozen: item.is_frozen,
                frozen_price: item.frozen_price || null,
                frozen_currency: item.frozen_currency || 'USD',
                package_price_usd: item.package_price_usd || 0,
                client_updated_at: item.server_updated_at || null
            });
        }
    };

    const updateDetailPrice = (index, field, value) => {
        const item = { ...details[index] };
        const numVal = parseFloat(value) || 0;
        const itemCostUsd = getCostInUSD(item.package_cost, item.native_currency);

        if (field === 'package_price') {
            item.package_price = numVal;
            item.package_price_cop_str = undefined;
            item.unit_price = item.units_per_package > 0
                ? Math.round((numVal / item.units_per_package) * 1000000) / 1000000
                : 0;
            item.margin_percentage = itemCostUsd > 0
                ? Math.round(((numVal - itemCostUsd) / itemCostUsd * 100) * 10000) / 10000
                : 0;
        } else if (field === 'package_price_cop') {
            item.package_price_cop_str = value;
            const rate = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
            const usdVal = numVal / rate;
            item.package_price = Math.round(usdVal * 1000000) / 1000000;
            item.unit_price = item.units_per_package > 0
                ? Math.round((usdVal / item.units_per_package) * 1000000) / 1000000
                : 0;
            item.margin_percentage = itemCostUsd > 0
                ? Math.round(((usdVal - itemCostUsd) / itemCostUsd * 100) * 10000) / 10000
                : 0;
            if (item.is_frozen && item.frozen_currency === 'COP') {
                item.frozen_price = numVal;
            }
        } else if (field === 'margin_percentage') {
            item.margin_percentage = numVal;
            item.package_price_cop_str = undefined;
            item.package_price = itemCostUsd > 0
                ? Math.round(itemCostUsd * (1 + numVal / 100) * 1000000) / 1000000
                : 0;
            item.unit_price = item.units_per_package > 0
                ? Math.round((item.package_price / item.units_per_package) * 1000000) / 1000000
                : 0;
        } else if (field === 'package_price_usd') {
            item.package_price_usd = numVal;
        }

        setDetails(prev => {
            const updated = [...prev];
            updated[index] = item;
            return updated;
        });

        // Auto-save solo cuando estamos editando una lista existente
        if (editingListRef.current) {
            const key = `${item.product_id}-${item.presentation_id}`;
            autoSaveDetail(key, {
                product_id: item.product_id,
                presentation_id: item.presentation_id,
                package_cost: item.package_cost,
                unit_cost: item.unit_cost,
                package_price: item.package_price,
                unit_price: item.unit_price,
                margin_percentage: item.margin_percentage,
                is_frozen: item.is_frozen,
                frozen_price: item.frozen_price || null,
                frozen_currency: item.frozen_currency || 'USD',
                package_price_usd: item.package_price_usd || 0,
                client_updated_at: item.server_updated_at || null
            });
        }
    };

    // Mutation: export CSV
    const exportMutation = useMutation({
        mutationFn: (id) => priceListService.exportCSV(id),
        onSuccess: () => {
            toast.success('CSV exportado');
        },
        onError: () => {
            toast.error('Error al exportar');
        }
    });

    const handleExportCSV = (id) => {
        exportMutation.mutate(id);
    };

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
      <html><head><title>Lista de Precios - ${editingList?.name || ''}</title>
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
            return (
                <div className="flex flex-col items-end leading-tight">
                    <div className={`text-gray-900 ${isBold ? 'font-bold' : 'font-medium'}`}>
                        {isCOP ? formatCOP(usdAmount) : `${baseCurrency} ${usdAmount.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                </div>
            );
        }

        const rate = calculateEffectiveRate('USD', 'COP', exchangeRates);

        if (!rate) {
            return (
                <div className="flex flex-col items-end leading-tight">
                    <div className={`text-gray-900 ${isBold ? 'font-bold' : 'font-medium'}`}>USD {formatUSD(usdAmount)}</div>
                </div>
            );
        }

        const copConverted = usdAmount * rate;

        return (
            <div className="flex flex-col items-end leading-tight gap-0.5">
                <div className={`text-gray-900 ${isBold ? 'font-bold' : 'font-medium'}`}>{formatCOP(copConverted)}</div>
                <div className="text-gray-500 font-medium text-[11px]">USD {formatUSD(usdAmount)}</div>
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
                    <h1 className="text-2xl font-bold text-gray-900">Lista de Precios</h1>
                    <div className="flex items-center gap-3">
                        {/* Indicador de auto-guardado (solo en edición) */}
                        {editingList && (
                            <div className="flex items-center gap-1.5 text-sm min-w-[110px]">
                                {autoSaveStatus === 'saving' && (
                                    <span className="text-primary-500 flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                                        Guardando...
                                    </span>
                                )}
                                {autoSaveStatus === 'saved' && (
                                    <span className="text-green-600 flex items-center gap-1">
                                        <CheckCircle className="w-3.5 h-3.5" /> Guardado
                                    </span>
                                )}
                                {autoSaveStatus === 'error' && (
                                    <span className="text-red-600 flex items-center gap-1">
                                        <WarningCircle className="w-3.5 h-3.5" /> Error al guardar
                                    </span>
                                )}
                            </div>
                        )}
                        {editingList && (
                            <>
                                <button onClick={handlePrint} className="btn-secondary flex items-center gap-2" title="Imprimir">
                                    <Printer className="w-4 h-4" /> Imprimir
                                </button>
                                <Button variant="secondary" size="icon" onClick={() => handleExportCSV(editingList.id)} title="Exportar CSV">
                                    <FileCsv className="w-4 h-4 text-emerald-600" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <Package className="w-5 h-5 text-primary-600" /> Productos ({details.length})
                            </h2>
                            <div className="relative w-64">
                                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    value={detailSearch}
                                    onChange={e => setDetailSearch(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-200 focus:border-transparent text-sm"
                                    placeholder="Buscar producto..."
                                />
                                {detailSearch && (
                                    <button
                                        onClick={() => setDetailSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Printable area */}
                    <div ref={printRef}>
                        <div className="print-header" style={{ display: 'none' }}>
                            <h1>{editingList?.name || 'Lista de Precios'}</h1>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Producto</th>
                                        <th className="px-4 py-3 text-left font-semibold text-gray-600">Presentación</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Costo/Paquete</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Costo Unit.</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Precio/Paquete COP</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Precio/Paquete USD</th>
                                        <th className="px-4 py-3 text-right font-semibold text-gray-600">Margen %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredDetails.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-8 text-center text-gray-500"> {/* 7 columns */}
                                                {details.length === 0
                                                    ? 'No hay productos con stock disponibles para esta lista.'
                                                    : 'No se encontraron productos que coincidan con la búsqueda.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDetails.map((d, idx) => {
                                            const realIdx = details.findIndex(x => x.presentation_id === d.presentation_id && x.product_id === d.product_id);
                                            const rowKey = `${d.product_id}-${d.presentation_id}`;
                                            const hasError = autoSaveErrorKeys.has(rowKey);
                                            return (
                                                <tr key={rowKey} className={`hover:bg-gray-50 ${hasError ? 'bg-red-50 border-l-2 border-red-400' : ''}`}>
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <div className="font-medium text-gray-900">{d.product_name}</div>
                                                            <div className="text-xs text-gray-500">{d.product_sku}</div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-700">{d.presentation_name}</td>
                                                    <td className={`px-4 py-3 text-right ${d.native_currency === 'USD' ? 'bg-green-50' : ''}`}>
                                                        {renderCostDisplay(d.package_cost, d.native_currency, false)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {renderCostDisplay(d.unit_cost, d.native_currency, false)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {d.base_currency === 'USD' ? (
                                                                <>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => toggleFreeze(realIdx)}
                                                                            className={`p-1 rounded transition-colors ${d.is_frozen ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
                                                                            title={d.is_frozen ? "Descongelar precio" : "Congelar precio"}
                                                                        >
                                                                            {d.is_frozen ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                        <span className="text-gray-500 font-medium text-xs">COP</span>
                                                                        <input
                                                                            type="number"
                                                                            step="100"
                                                                            min="0"
                                                                            value={
                                                                                d.is_frozen && d.frozen_currency === 'COP'
                                                                                ? (d.frozen_price ?? '')
                                                                                : (d.package_price_cop_str !== undefined ? d.package_price_cop_str : (d.package_price ? Math.round(d.package_price * (calculateEffectiveRate('USD', 'COP', exchangeRates) || 1)) : ''))
                                                                            }
                                                                            onChange={e => updateDetailPrice(realIdx, 'package_price_cop', e.target.value)}
                                                                            className={`w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-primary-200 focus:border-transparent font-medium ${d.is_frozen ? 'bg-primary-50 border-primary-200' : 'border-gray-300'}`}
                                                                        />
                                                                    </div>
                                                                    <div className="text-gray-500 font-medium text-[11px]">
                                                                        USD {
                                                                            d.is_frozen && d.frozen_currency === 'COP' && d.frozen_price
                                                                            ? formatUSD(d.frozen_price / (calculateEffectiveRate('USD', 'COP', exchangeRates) || 1))
                                                                            : formatUSD(d.package_price || 0)
                                                                        }
                                                                        {d.is_frozen && d.frozen_currency === 'COP' && <span className="ml-1 text-[9px] text-primary-400 opacity-70">(est.)</span>}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <div className="flex items-center gap-1">
                                                                        <button
                                                                            onClick={() => toggleFreeze(realIdx)}
                                                                            className={`p-1 rounded transition-colors ${d.is_frozen ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:bg-gray-100'}`}
                                                                            title={d.is_frozen ? "Descongelar precio" : "Congelar precio"}
                                                                        >
                                                                            {d.is_frozen ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                                                                        </button>
                                                                        <span className="text-gray-500 font-medium text-xs">{d.base_currency}</span>
                                                                        <input
                                                                            type="number"
                                                                            step={d.base_currency === 'COP' ? "100" : "0.01"}
                                                                            min="0"
                                                                            value={d.package_price || ''}
                                                                            onChange={e => updateDetailPrice(realIdx, 'package_price', e.target.value)}
                                                                            className={`w-24 px-2 py-1 border rounded text-right focus:ring-2 focus:ring-primary-200 focus:border-transparent font-medium ${d.is_frozen ? 'bg-primary-50 border-primary-200' : 'border-gray-300'}`}
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <input
                                                            type="number"
                                                            step="0.5"
                                                            min="0"
                                                            value={d.package_price_usd || ''}
                                                            onChange={e => updateDetailPrice(realIdx, 'package_price_usd', e.target.value)}
                                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-right focus:ring-2 focus:ring-primary-200 focus:border-transparent font-medium"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {(() => {
                                                            const costUsd = getCostInUSD(d.package_cost, d.native_currency);
                                                            // For frozen COP prices, compute COP margin from COP values directly
                                                            // to avoid stale rate mismatch (package_price USD saved at old rate vs cost converted at current rate)
                                                            let marginCop;
                                                            if (d.is_frozen && d.frozen_currency === 'COP' && d.frozen_price) {
                                                                const copCost = d.native_currency === 'COP'
                                                                    ? d.package_cost
                                                                    : (d.package_cost || 0) * (calculateEffectiveRate('USD', 'COP', exchangeRates) || 1);
                                                                marginCop = copCost > 0 ? ((d.frozen_price - copCost) / copCost * 100) : 0;
                                                            } else {
                                                                marginCop = d.margin_percentage || 0;
                                                            }
                                                            const marginUsd = costUsd > 0 ? ((d.package_price_usd - costUsd) / costUsd * 100) : 0;
                                                            const fmtMargin = (v) => v.toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                                                            const colorClass = (v) => v < 0 ? 'text-red-600' : v === 0 ? 'text-gray-400' : 'text-green-700';
                                                            return (
                                                                <div className="flex flex-col items-end leading-tight gap-0.5">
                                                                    <span className={`text-xs font-medium ${colorClass(marginCop)}`}>
                                                                        {fmtMargin(marginCop)}% COP
                                                                    </span>
                                                                    <span className={`text-xs font-medium ${colorClass(marginUsd)}`}>
                                                                        {fmtMargin(marginUsd)}% USD
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
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


    // ===================== LOADING STATE (auto-load LP-0013) =====================
    return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2" />
                <p className="text-gray-500">Cargando lista de precios...</p>
            </div>
        </div>
    );
};

export default PriceListsPage;
