import React, { useState, useEffect } from 'react';
import { X, Receipt, ArrowDownRight, ArrowUpRight, Loader, Info, Repeat, ChevronDown, ChevronRight, CreditCard } from 'lucide-react';
import { customerService } from '../../services/api/customerService';
import { saleService } from '../../services/api/saleService';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

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

    const appliedCNs = transaction.original_data?.applied_credit_notes || [];

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
            {appliedCNs.length > 0 && (
                <div className="mt-2 border border-blue-200 rounded-lg overflow-hidden">
                    <div className="bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">Devoluciones Aplicadas</div>
                    <table className="w-full text-xs">
                        <tbody>
                            {appliedCNs.map((cn) => (
                                <tr key={cn.id} className="border-t border-blue-100">
                                    <td className="px-3 py-1.5 text-blue-700 font-medium">{cn.number}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{new Date(cn.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: '2-digit' })}</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-blue-700">
                                        -{formatCurrency(currency === 'COP' ? cn.total_cop : cn.total_usd, currency)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-blue-200 bg-blue-50">
                                <td colSpan="2" className="px-3 py-1.5 text-right font-semibold text-blue-800">Neto a pagar</td>
                                <td className="px-3 py-1.5 text-right font-bold text-orange-700">
                                    {formatCurrency(
                                        (currency === 'COP'
                                            ? parseFloat(detail.total || 0) * rate - appliedCNs.reduce((s, cn) => s + cn.total_cop, 0)
                                            : parseFloat(detail.total || 0) - appliedCNs.reduce((s, cn) => s + cn.total_usd, 0)),
                                        currency
                                    )}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
};

const CreditNoteDetailExpanded = ({ transaction }) => {
    const note = transaction.original_data;
    const exchangeRate = parseFloat(note.exchange_rate || note.sale?.exchange_rate || 1);
    const totalUSD = parseFloat(note.total || 0);
    const totalCOP = Math.round(totalUSD * exchangeRate);

    const refundLabels = {
        credit_balance: 'Monedero (Saldo a Favor)',
        cash: 'Efectivo',
        transfer: 'Transferencia',
        usdt: 'USDT',
        none: 'Sin reembolso'
    };
    const typeLabels = { full: 'Devolución Total', partial: 'Devolución Parcial' };

    return (
        <div className="flex flex-wrap gap-6 text-xs text-gray-600">
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Tipo</span>
                <span className="text-gray-800">{typeLabels[note.type] || note.type}</span>
            </div>
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Método de reembolso</span>
                <span className="text-gray-800">{refundLabels[note.refund_method] || note.refund_method}</span>
            </div>
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Monto devuelto</span>
                <span className="text-blue-700 font-semibold">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalCOP)}
                </span>
            </div>
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Tasa aplicada</span>
                <span className="text-gray-800">{exchangeRate.toLocaleString('es-CO')} COP/USD</span>
            </div>
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
        usdt: 'USDT',
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
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statementData, setStatementData] = useState(null);
    const [selectedCurrency, setSelectedCurrency] = useState('COP');
    const [expandedId, setExpandedId] = useState(null);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [paymentData, setPaymentData] = useState({
        amount: '',
        method: 'cash',
        reference: '',
        notes: ''
    });
    const [submittingPayment, setSubmittingPayment] = useState(false);

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

            if (data.data) {
                setStatementData(data.data);
                const availableCurrencies = Object.keys(data.data.summary || {});
                if (availableCurrencies.length > 0 && !availableCurrencies.includes('USD')) {
                    setSelectedCurrency(availableCurrencies[0]);
                }
                return data.data;
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
        let runningBalance = 0;
        return statementData.ledger
            .filter(t => t.currency === selectedCurrency)
            .map(t => {
                runningBalance = t.type === 'charge'
                    ? runningBalance + t.amount  // venta: suma deuda
                    : runningBalance - t.amount; // pagos, CN, y uso de saldo a favor: reducen deuda
                return { ...t, runningBalance };
            });
    };

    const handleToggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const getPendingInCurrency = (transaction) => {
        const rate = parseFloat(transaction.original_data?.exchange_rate || 1);
        const paidUSD = parseFloat(transaction.original_data?.paid_amount || 0);
        const paidInCurrency = selectedCurrency === 'USD' ? paidUSD : paidUSD * rate;
        const cnAmount = selectedCurrency === 'USD'
            ? parseFloat(transaction.original_data?.cn_amount_usd || 0)
            : parseFloat(transaction.original_data?.cn_amount_cop || 0);
        return Math.max(0, transaction.amount - paidInCurrency - cnAmount);
    };

    const handleOpenPaymentModal = (transaction) => {
        setSelectedTransaction(transaction);
        const credit = statementData?.summary?.[selectedCurrency]?.available_credit || 0;
        const pending = getPendingInCurrency(transaction);
        const cashAmount = Math.max(0, pending - credit);
        setPaymentData({
            amount: cashAmount > 0 ? cashAmount.toFixed(2) : '',
            method: 'cash',
            reference: '',
            notes: ''
        });
        setShowPaymentModal(true);
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        const credit = statementData?.summary?.[selectedCurrency]?.available_credit || 0;
        const pending = getPendingInCurrency(selectedTransaction);
        const creditToApply = Math.min(credit, pending);
        const cashAmount = parseFloat(paymentData.amount) || 0;

        if (cashAmount <= 0 && creditToApply <= 0) {
            toast.error('Debe ingresar un monto válido mayor a 0');
            return;
        }

        setSubmittingPayment(true);
        try {
            const saleId = selectedTransaction.original_data.id;
            const rate = parseFloat(selectedTransaction.original_data.exchange_rate) || 1;

            const payment_lines = [];
            if (creditToApply > 0) {
                payment_lines.push({
                    amount: creditToApply,
                    method: 'credit_balance',
                    currency: selectedCurrency,
                    exchange_rate: rate,
                    reference: ''
                });
            }
            if (cashAmount > 0) {
                payment_lines.push({
                    amount: cashAmount,
                    method: paymentData.method,
                    currency: selectedCurrency,
                    exchange_rate: rate,
                    reference: paymentData.reference
                });
            }

            await saleService.addPayment(saleId, {
                payment_lines,
                notes: paymentData.notes
            });

            toast.success('Pago registrado exitosamente');

            // Refresh the statement data before closing modal
            setLoading(true);
            await fetchStatement();
            setLoading(false);

            setShowPaymentModal(false);
            setSelectedTransaction(null);

            queryClient.invalidateQueries({ queryKey: ['sales'] });
        } catch (error) {
            console.error('Error adding payment:', error);
            toast.error(error.response?.data?.message || 'Error al registrar el pago');
        } finally {
            setSubmittingPayment(false);
        }
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
                                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Saldo</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {getFilteredLedger().length === 0 ? (
                                                        <tr>
                                                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
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
                                                                            <div className="flex items-center gap-2">
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
                                                                                {isCharge && t.original_data?.status !== 'completed' && (parseFloat(t.original_data?.total || 0) - parseFloat(t.original_data?.paid_amount || 0)) > 0.01 && (
                                                                                    <button
                                                                                        onClick={() => handleOpenPaymentModal(t)}
                                                                                        className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors font-medium flex items-center gap-1"
                                                                                        title="Registrar abono para esta factura"
                                                                                    >
                                                                                        <CreditCard className="w-3.5 h-3.5" />
                                                                                        Pagar
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                                            <div className="flex flex-col">
                                                                                <span className={`text-sm font-semibold ${t.type === 'charge' ? 'text-orange-600' :
                                                                                    t.type === 'credit' ? 'text-blue-600' :
                                                                                        t.isInternal ? 'text-purple-600' : 'text-green-600'
                                                                                    }`}>
                                                                                    {t.type === 'charge'
                                                                                        ? (t.original_data?.sale_type === 'cash' ? 'Venta Contado' : 'Nota de Débito (Venta)')
                                                                                        : t.type === 'credit' ? 'Nota de Crédito (Devolución)'
                                                                                            : t.isInternal ? 'Uso de Saldo a Favor' : 'Pago Recibido'}
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
                                                                            {t.type === 'charge' ? (() => {
                                                                                const cnAmt = selectedCurrency === 'USD'
                                                                                    ? parseFloat(t.original_data?.cn_amount_usd || 0)
                                                                                    : parseFloat(t.original_data?.cn_amount_cop || 0);
                                                                                const netAmt = t.amount - cnAmt;
                                                                                return cnAmt > 0 ? (
                                                                                    <div className="flex flex-col items-end">
                                                                                        <span className="text-orange-300 line-through text-xs">{formatCurrency(t.amount, t.currency)}</span>
                                                                                        <span className="text-orange-600 font-bold">{formatCurrency(netAmt, t.currency)}</span>
                                                                                        <span className="text-blue-500 text-[10px]">NC: -{formatCurrency(cnAmt, t.currency)}</span>
                                                                                    </div>
                                                                                ) : (
                                                                                    <span className="text-orange-600">{formatCurrency(t.amount, t.currency)}</span>
                                                                                );
                                                                            })() : (
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
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">
                                                                            <span className={
                                                                                t.runningBalance > 0.009
                                                                                    ? 'text-red-600'
                                                                                    : t.runningBalance < -0.009
                                                                                        ? 'text-green-600'
                                                                                        : 'text-gray-400'
                                                                            }>
                                                                                {formatCurrency(Math.abs(t.runningBalance), t.currency)}
                                                                                {t.runningBalance < -0.009 && (
                                                                                    <span className="block text-[10px] font-normal">a favor</span>
                                                                                )}
                                                                            </span>
                                                                        </td>
                                                                    </tr>

                                                                    {isExpanded && (
                                                                        <tr className={expandBg}>
                                                                            <td colSpan="6" className={`px-8 py-4 border-t ${expandBorder}`}>
                                                                                {t.type === 'charge' ? (
                                                                                    <SaleDetailExpanded transaction={t} currency={selectedCurrency} />
                                                                                ) : t.type === 'credit' ? (
                                                                                    <CreditNoteDetailExpanded transaction={t} />
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

            {/* Payment Modal */}
            {showPaymentModal && selectedTransaction && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 transition-opacity" onClick={() => !submittingPayment && setShowPaymentModal(false)}>
                            <div className="absolute inset-0 bg-gray-900 opacity-75 backdrop-blur-sm"></div>
                        </div>

                        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle w-full max-w-md">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-emerald-700 to-emerald-900 px-6 py-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CreditCard className="h-6 w-6 text-emerald-200" />
                                        <div>
                                            <h3 className="text-xl font-bold text-white leading-tight">Registrar Abono</h3>
                                            <p className="text-emerald-200 text-sm font-medium">{selectedTransaction.reference}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => !submittingPayment && setShowPaymentModal(false)}
                                        className="text-white hover:text-red-300 hover:bg-white/10 p-2 rounded-full transition-colors"
                                        title="Cerrar"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                                    <p className="text-xs text-emerald-800 font-semibold">Monto Facturado</p>
                                    <p className="text-lg font-bold text-emerald-900">
                                        {formatCurrency(selectedTransaction.amount, selectedCurrency)}
                                    </p>
                                </div>

                                {statementData?.summary?.[selectedCurrency]?.available_credit > 0 && (
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 flex items-center justify-between gap-2">
                                        <div>
                                            <p className="text-xs text-blue-800 font-semibold">Saldo a Favor del Cliente</p>
                                            <p className="text-base font-bold text-blue-700">
                                                {formatCurrency(Math.min(statementData.summary[selectedCurrency].available_credit, getPendingInCurrency(selectedTransaction)), selectedCurrency)}
                                            </p>
                                        </div>
                                        <p className="text-xs text-blue-600 font-medium text-right">Descontado del<br/>monto a pagar</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Monto a Abonar ({selectedCurrency})
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
                                            {selectedCurrency === 'COP' ? '$' : selectedCurrency}
                                        </span>
                                        <input
                                            type="number"
                                            required
                                            min="0.01"
                                            step="0.01"
                                            value={paymentData.amount}
                                            onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-medium text-lg"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Método de Pago
                                        </label>
                                        <select
                                            required
                                            value={paymentData.method}
                                            onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        >
                                            <option value="cash">Efectivo</option>
                                            <option value="card">Tarjeta / Punto</option>
                                            <option value="transfer">Transferencia</option>
                                            <option value="check">Cheque</option>
                                            <option value="credit_balance">Saldo a Favor</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Referencia
                                        </label>
                                        <input
                                            type="text"
                                            value={paymentData.reference}
                                            onChange={(e) => setPaymentData({ ...paymentData, reference: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                            placeholder="Ej. #12345"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Notas adicionales
                                    </label>
                                    <textarea
                                        value={paymentData.notes}
                                        onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                        rows="2"
                                        placeholder="Observaciones sobre el pago..."
                                    ></textarea>
                                </div>

                                <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => !submittingPayment && setShowPaymentModal(false)}
                                        disabled={submittingPayment}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingPayment}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {submittingPayment ? (
                                            <>
                                                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                                Procesando...
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard className="w-4 h-4" />
                                                Registrar Abono
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomerStatementModal;
