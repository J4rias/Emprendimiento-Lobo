import React, { useState, useEffect } from 'react';
import { X, Receipt, ArrowDownRight, ArrowUpRight, Loader, Info, Repeat, ChevronDown, ChevronRight } from 'lucide-react';
import { customerService } from '../../services/api/customerService';
import { saleService } from '../../services/api/saleService';

const formatCurrency = (amount, currency) => {
    const value = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: currency === 'COP' ? 0 : 2,
        maximumFractionDigits: currency === 'COP' ? 0 : 2
    }).format(value);
};

const SaleDetailExpanded = ({ transaction, currency }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const data = await saleService.getSaleById(transaction.original_data.id);
                setDetail(data.sale || data);
            } catch (e) {
                console.error('Error fetching sale detail:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [transaction.original_data.id]);

    if (loading) return (
        <div className="flex items-center gap-2 py-3 text-gray-500 text-sm">
            <Loader className="w-4 h-4 animate-spin" /> Cargando detalle...
        </div>
    );

    if (!detail) return <p className="text-red-500 text-sm py-2">No se pudo cargar el detalle.</p>;

    const rate = parseFloat(detail.exchange_rate || 1);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span><span className="font-medium">Tipo:</span> {detail.sale_type === 'cash' ? 'Contado' : 'Crédito'}</span>
                <span><span className="font-medium">Estado:</span> {detail.status === 'completed' ? 'Completada' : detail.status === 'pending' ? 'Pendiente' : 'Cancelada'}</span>
                <span><span className="font-medium">Tasa:</span> {rate.toLocaleString('es-CO')} COP/USD</span>
            </div>
            {detail.details?.length > 0 && (
                <table className="w-full text-xs border-collapse">
                    <thead>
                        <tr className="bg-orange-50 text-orange-800">
                            <th className="text-left px-3 py-1.5 font-semibold">Producto</th>
                            <th className="text-right px-3 py-1.5 font-semibold">Cant.</th>
                            <th className="text-right px-3 py-1.5 font-semibold">Precio Unit.</th>
                            <th className="text-right px-3 py-1.5 font-semibold">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detail.details.map((item, i) => {
                            const unitPrice = parseFloat(item.unit_price || 0);
                            const qty = parseFloat(item.quantity || 0);
                            const subtotal = parseFloat(item.subtotal || unitPrice * qty);
                            const displayPrice = currency === 'COP' ? unitPrice * rate : unitPrice;
                            const displaySubtotal = currency === 'COP' ? subtotal * rate : subtotal;
                            return (
                                <tr key={i} className="border-t border-orange-100">
                                    <td className="px-3 py-1.5 text-gray-700">
                                        {item.product?.name || item.presentation?.product?.name || '—'}
                                        {item.presentation?.name && <span className="text-gray-400 ml-1">({item.presentation.name})</span>}
                                    </td>
                                    <td className="px-3 py-1.5 text-right text-gray-700">{qty}</td>
                                    <td className="px-3 py-1.5 text-right text-gray-700">{formatCurrency(displayPrice, currency)}</td>
                                    <td className="px-3 py-1.5 text-right font-medium text-gray-800">{formatCurrency(displaySubtotal, currency)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-orange-200 bg-orange-50">
                            <td colSpan="3" className="px-3 py-1.5 text-right font-semibold text-orange-800">Total</td>
                            <td className="px-3 py-1.5 text-right font-bold text-orange-800">
                                {formatCurrency(currency === 'COP' ? parseFloat(detail.total || 0) * rate : parseFloat(detail.total || 0), currency)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            )}
        </div>
    );
};

const PaymentDetailExpanded = ({ transaction, currency }) => {
    const pay = transaction.original_data;
    const storedCurrency = pay.currency || 'USD';
    const storedAmount = parseFloat(pay.amount || 0);
    const storedRate = parseFloat(pay.exchange_rate || 1);
    const saleRate = parseFloat(pay.sale?.exchange_rate || 1);

    // Legacy detection: stored as USD with rate=1 but the sale has a real exchange rate.
    // This means the original payment was in COP but was incorrectly converted before saving.
    const isLegacy = storedCurrency === 'USD' && storedRate === 1 && saleRate > 1;

    // Effective rate to use for conversions (mirrors backend logic)
    const effectiveRate = isLegacy ? saleRate : (storedRate !== 1 ? storedRate : saleRate);

    // Derive the best display values
    // For legacy: the stored USD amount is actually the already-converted value; COP = amount * saleRate
    // For proper COP payments: show COP directly
    const displayCurrency = isLegacy ? 'USD' : storedCurrency;
    const displayAmount = storedAmount;
    const copEquivalent = isLegacy ? storedAmount * effectiveRate : (storedCurrency === 'COP' ? storedAmount : storedAmount * effectiveRate);
    const usdEquivalent = isLegacy ? storedAmount : (storedCurrency === 'USD' ? storedAmount : storedAmount / effectiveRate);

    const methodLabels = {
        cash: 'Efectivo',
        transfer: 'Transferencia',
        card: 'Tarjeta',
        check: 'Cheque',
        credit_balance: 'Monedero',
    };

    return (
        <div className="space-y-2">
            {isLegacy && (
                <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    Registro histórico — moneda original no disponible. Los montos se recalculan con la tasa de la venta.
                </p>
            )}
            <div className="flex flex-wrap gap-6 text-xs text-gray-600">
                <div>
                    <span className="font-medium block text-gray-500 mb-0.5">Método</span>
                    <span className="text-gray-800">{methodLabels[pay.payment_method] || pay.payment_method}</span>
                </div>
                <div>
                    <span className="font-medium block text-gray-500 mb-0.5">{isLegacy ? 'Valor USD' : 'Monto recibido'}</span>
                    <span className="text-green-700 font-semibold">{formatCurrency(displayAmount, displayCurrency)}</span>
                </div>
                {storedCurrency !== 'COP' && (
                    <div>
                        <span className="font-medium block text-gray-500 mb-0.5">Equivalente COP</span>
                        <span className="text-gray-800">{formatCurrency(copEquivalent, 'COP')}</span>
                    </div>
                )}
                {currency === 'USD' && storedCurrency !== 'USD' && (
                    <div>
                        <span className="font-medium block text-gray-500 mb-0.5">Equivalente USD</span>
                        <span className="text-gray-800">{formatCurrency(usdEquivalent, 'USD')}</span>
                    </div>
                )}
                {storedCurrency !== 'COP' && (
                    <div>
                        <span className="font-medium block text-gray-500 mb-0.5">Tasa aplicada</span>
                        <span className="text-gray-800">{effectiveRate.toLocaleString('es-CO')} COP/USD</span>
                    </div>
                )}
                {pay.reference && (
                    <div>
                        <span className="font-medium block text-gray-500 mb-0.5">Referencia</span>
                        <span className="text-gray-800">{pay.reference}</span>
                    </div>
                )}
                {pay.sale?.sale_number && (
                    <div>
                        <span className="font-medium block text-gray-500 mb-0.5">Abono a</span>
                        <span className="text-gray-800">{pay.sale.sale_number}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const CustomerStatementModal = ({ customer, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statementData, setStatementData] = useState(null);
    const [selectedCurrency, setSelectedCurrency] = useState('COP');
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        if (customer?.id) {
            fetchStatement();
        }
    }, [customer]);

    const fetchStatement = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await customerService.getStatement(customer.id);

            if (data.success) {
                setStatementData(data.data);
                const availableCurrencies = Object.keys(data.data.summary || {});
                if (availableCurrencies.length > 0 && !availableCurrencies.includes('USD')) {
                    setSelectedCurrency(availableCurrencies[0]);
                }
            }
        } catch (err) {
            setError('Error al cargar el estado de cuenta. Por favor, intente nuevamente.');
            console.error('Error fetching statement:', err);
        } finally {
            setLoading(false);
        }
    };

    const getFilteredLedger = () => {
        if (!statementData?.ledger) return [];
        return statementData.ledger.filter(t => t.currency === selectedCurrency);
    };

    const handleToggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const renderSummaryCard = (title, amount, currency, bgColor, textColor, Icon) => (
        <div className={`p-4 rounded-xl ${bgColor} border ${bgColor.replace('50', '200')}`}>
            <div className="flex items-center justify-between mb-2">
                <h4 className={`text-sm font-medium ${textColor}`}>{title}</h4>
                <Icon className={`h-5 w-5 ${textColor} opacity-80`} />
            </div>
            <p className={`text-2xl font-bold ${textColor}`}>
                {formatCurrency(amount, currency)}
            </p>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" onClick={onClose}>
                    <div className="absolute inset-0 bg-gray-900 opacity-75 backdrop-blur-sm"></div>
                </div>

                <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle w-full max-w-5xl">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-teal-700 to-teal-900 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Receipt className="h-6 w-6 text-teal-200" />
                                <div>
                                    <h3 className="text-xl font-bold text-white leading-tight">Estado de Cuenta (Kardex)</h3>
                                    <p className="text-teal-200 text-sm font-medium">{customer?.businessName || `${customer?.firstName} ${customer?.lastName}`}</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-white hover:text-red-300 hover:bg-white/10 p-2 rounded-full transition-colors"
                                title="Cerrar"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                    </div>

                    <div className="bg-gray-50 flex flex-col min-h-[500px] max-h-[80vh]">
                        {loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <Loader className="h-10 w-10 text-teal-600 animate-spin mb-4" />
                                <p className="text-gray-500 font-medium">Generando balance financiero del cliente...</p>
                            </div>
                        ) : error ? (
                            <div className="flex-1 flex items-center justify-center p-6">
                                <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 max-w-md">
                                    <Info className="h-5 w-5 mt-0.5" />
                                    <p>{error}</p>
                                </div>
                            </div>
                        ) : !statementData ? (
                            <div className="flex-1 flex items-center justify-center p-6 text-gray-500">
                                No hay datos disponibles para este cliente.
                            </div>
                        ) : (
                            <div className="flex flex-col h-full overflow-hidden">
                                {/* Top Bar (Filters) */}
                                <div className="px-6 py-4 border-b border-gray-200 bg-white shadow-sm z-10">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <h4 className="font-semibold text-gray-700 text-lg">Resumen Financiero</h4>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-gray-600">Moneda:</span>
                                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                                {['USD', 'COP', 'VES'].map((curr) => {
                                                    const hasData = statementData.summary[curr] !== undefined;
                                                    return (
                                                        <button
                                                            key={curr}
                                                            onClick={() => { setSelectedCurrency(curr); setExpandedId(null); }}
                                                            disabled={!hasData}
                                                            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${selectedCurrency === curr
                                                                ? 'bg-white text-teal-700 shadow-sm ring-1 ring-gray-200'
                                                                : hasData
                                                                    ? 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                                                                    : 'text-gray-400 opacity-50 cursor-not-allowed hidden'
                                                                }`}
                                                        >
                                                            {curr}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Area (Scrollable) */}
                                <div className="flex-1 overflow-y-auto px-6 py-6 pb-20">
                                    {/* Summary Cards */}
                                    {statementData.summary[selectedCurrency] ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                                            {renderSummaryCard(
                                                'Total Facturado (Crédito)',
                                                statementData.summary[selectedCurrency].total_invoiced,
                                                selectedCurrency,
                                                'bg-blue-50',
                                                'text-blue-800',
                                                Receipt
                                            )}
                                            {renderSummaryCard(
                                                'Total Pagado (Histórico)',
                                                statementData.summary[selectedCurrency].total_paid,
                                                selectedCurrency,
                                                'bg-teal-50',
                                                'text-teal-800',
                                                ArrowUpRight
                                            )}
                                            {renderSummaryCard(
                                                'Saldo Pendiente',
                                                Math.max(0, statementData.summary[selectedCurrency].balance),
                                                selectedCurrency,
                                                statementData.summary[selectedCurrency].balance > 0 ? 'bg-orange-50' : 'bg-gray-100',
                                                statementData.summary[selectedCurrency].balance > 0 ? 'text-orange-800' : 'text-gray-600',
                                                ArrowDownRight
                                            )}
                                            {renderSummaryCard(
                                                'Saldo a Favor',
                                                statementData.summary[selectedCurrency].available_credit,
                                                selectedCurrency,
                                                statementData.summary[selectedCurrency].available_credit > 0 ? 'bg-green-50' : 'bg-gray-50',
                                                statementData.summary[selectedCurrency].available_credit > 0 ? 'text-green-700' : 'text-gray-500',
                                                Repeat
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-orange-50 text-orange-800 p-4 rounded-lg mb-8 text-center font-medium">
                                            No hay operaciones registradas en esta moneda para este cliente.
                                        </div>
                                    )}

                                    {/* Ledger Table */}
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
                                            <h4 className="font-semibold text-gray-800">Historial de Transacciones ({selectedCurrency})</h4>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
                                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cargos (Deuda)</th>
                                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Abonos (Pagos)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {getFilteredLedger().length === 0 ? (
                                                        <tr>
                                                            <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                                                No se encontraron transacciones en {selectedCurrency}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        getFilteredLedger().map((t) => {
                                                            const isExpanded = expandedId === t.id;
                                                            const isCharge = t.type === 'charge';
                                                            const expandBg = isCharge ? 'bg-orange-50/60' : 'bg-green-50/60';
                                                            const expandBorder = isCharge ? 'border-orange-100' : 'border-green-100';

                                                            return (
                                                                <React.Fragment key={t.id}>
                                                                    <tr className={`transition-colors ${isExpanded ? (isCharge ? 'bg-orange-50/30' : 'bg-green-50/30') : 'hover:bg-teal-50/50'}`}>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                                            {new Date(t.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' })}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                                            <button
                                                                                onClick={() => handleToggleExpand(t.id)}
                                                                                className="flex items-center gap-1.5 text-teal-700 hover:text-teal-900 hover:underline font-semibold transition-colors"
                                                                                title="Ver detalle"
                                                                            >
                                                                                {isExpanded
                                                                                    ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                                                                                    : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                                                                                }
                                                                                {t.reference || '-'}
                                                                            </button>
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                                            <div className="flex flex-col">
                                                                                <span className={`text-sm font-semibold ${t.type === 'charge' ? 'text-orange-600' :
                                                                                    t.type === 'credit' ? 'text-blue-600' :
                                                                                        t.isInternal ? 'text-purple-600' : 'text-green-600'
                                                                                    }`}>
                                                                                    {t.type === 'charge' ? 'Nota de Débito (Venta)' :
                                                                                        t.type === 'credit' ? 'Nota de Crédito (Devolución)' :
                                                                                            t.isInternal ? 'Uso de Saldo a Favor' : 'Pago Recibido'}
                                                                                </span>
                                                                                <span className="text-xs text-gray-500">{t.description}</span>
                                                                                {t.original_currency && t.original_currency !== selectedCurrency && (
                                                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                                                        Original: {formatCurrency(t.original_amount, t.original_currency)}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                                                                            {t.type === 'charge' ? (
                                                                                <span className="text-orange-600">{formatCurrency(t.amount, t.currency)}</span>
                                                                            ) : (
                                                                                <span className="text-gray-300">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                                                                            {t.type !== 'charge' ? (
                                                                                <span className={t.isInternal ? "text-purple-600" : (t.type === 'credit' ? 'text-blue-600' : "text-green-600")}>
                                                                                    {formatCurrency(t.amount, t.currency)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-gray-300">-</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>

                                                                    {isExpanded && (
                                                                        <tr className={expandBg}>
                                                                            <td colSpan="5" className={`px-8 py-4 border-t ${expandBorder}`}>
                                                                                {t.type === 'charge' ? (
                                                                                    <SaleDetailExpanded transaction={t} currency={selectedCurrency} />
                                                                                ) : (
                                                                                    <PaymentDetailExpanded transaction={t} currency={selectedCurrency} />
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </React.Fragment>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerStatementModal;
