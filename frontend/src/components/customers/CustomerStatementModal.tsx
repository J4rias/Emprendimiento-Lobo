import React, { useState, useEffect } from 'react';
import { X, Receipt, ArrowDownRight, ArrowUpRight, CircleNotch, Info, Repeat, CaretDown, CaretRight, CreditCard } from '@phosphor-icons/react';
import { customerService } from '../../services/api/customerService';
import { saleService } from '../../services/api/saleService';
import { exchangeRateService } from '../../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../../utils/exchangeRateUtils';
import { convertPaymentLinesToBackend, adjustPaymentLinesForChange, PaymentLine as PaymentLineUtil } from '../../utils/paymentUtils';
import { COP_TOLERANCE } from '../../hooks/usePOS';
import CheckoutModal from '../sales/CheckoutModal';
import { LOCALE, formatDateShort } from '../../utils/formatUtils';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PaymentLine, ExchangeRate } from '../../types';

const formatCurrency = (amount: number | string, currency?: string): string => {
    const value = parseFloat(String(amount)) || 0;
    return new Intl.NumberFormat('es-VE', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: currency === 'COP' ? 0 : 2,
        maximumFractionDigits: currency === 'COP' ? 0 : 2
    }).format(value);
};

interface Transaction {
  id: string;
  date: string;
  reference?: string;
  type: 'charge' | 'credit' | 'payment';
  amount: number;
  currency: string;
  description?: string;
  original_data?: Record<string, any>;
  original_currency?: string;
  original_amount?: number;
  runningBalance?: number;
  isInternal?: boolean;
}

interface SaleDetailExpandedProps {
  transaction: Transaction;
  currency: string;
}

const SaleDetailExpanded = ({ transaction, currency }: SaleDetailExpandedProps) => {
    const [detail, setDetail] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const data = await saleService.getSaleById(transaction.original_data?.id);
                setDetail(data.data || data);
            } catch (e) {
                console.error('Error fetching sale detail:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [transaction.original_data?.id])

    if (loading) return (
        <div className="flex items-center gap-2 py-3 text-gray-500 text-sm">
            <CircleNotch className="w-4 h-4 animate-spin" /> Cargando detalle...
        </div>
    );

    if (!detail) return <p className="text-red-500 text-sm py-2">No se pudo cargar el detalle.</p>;

    const rate = parseFloat(detail.exchange_rate || 1);

    const appliedCNs: any[] = transaction.original_data?.applied_credit_notes || [];

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                <span><span className="font-medium">Tipo:</span> {detail.sale_type === 'cash' ? 'Contado' : detail.sale_type === 'pos_pending' ? 'Pendiente de Cobro' : 'Crédito'}</span>
                <span><span className="font-medium">Estado:</span> {detail.status === 'completed' ? 'Completada' : detail.status === 'pending' ? 'Pendiente' : 'Cancelada'}</span>
                <span><span className="font-medium">Tasa:</span> {rate.toLocaleString(LOCALE)} COP/USD</span>
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
                        {detail.details.map((item: any, i: number) => {
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
                            <td colSpan={3} className="px-3 py-1.5 text-right font-semibold text-orange-800">Total</td>
                            <td className="px-3 py-1.5 text-right font-bold text-orange-800">
                                {formatCurrency(currency === 'COP' ? parseFloat(detail.total || 0) * rate : parseFloat(detail.total || 0), currency)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            )}
            {appliedCNs.length > 0 && (
                <div className="mt-2 border border-primary-200 rounded-lg overflow-hidden">
                    <div className="bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-800">Devoluciones Aplicadas</div>
                    <table className="w-full text-xs">
                        <tbody>
                            {appliedCNs.map((cn: any) => (
                                <tr key={cn.id} className="border-t border-primary-100">
                                    <td className="px-3 py-1.5 text-primary-700 font-medium">{cn.number}</td>
                                    <td className="px-3 py-1.5 text-gray-500">{formatDateShort(cn.date)}</td>
                                    <td className="px-3 py-1.5 text-right font-bold text-primary-700">
                                        -{formatCurrency(currency === 'COP' ? cn.total_cop : cn.total_usd, currency)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-primary-200 bg-primary-50">
                                <td colSpan={2} className="px-3 py-1.5 text-right font-semibold text-primary-800">Neto a pagar</td>
                                <td className="px-3 py-1.5 text-right font-bold text-orange-700">
                                    {formatCurrency(
                                        (currency === 'COP'
                                            ? parseFloat(detail.total || 0) * rate - appliedCNs.reduce((s: number, cn: any) => s + cn.total_cop, 0)
                                            : parseFloat(detail.total || 0) - appliedCNs.reduce((s: number, cn: any) => s + cn.total_usd, 0)),
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

interface CreditNoteDetailExpandedProps {
  transaction: Transaction;
}

const CreditNoteDetailExpanded = ({ transaction }: CreditNoteDetailExpandedProps) => {
    const note = transaction.original_data;
    const exchangeRate = parseFloat(note?.exchange_rate || note?.sale?.exchange_rate || 1);
    const totalUSD = parseFloat(note?.total || 0);
    const totalCOP = Math.round(totalUSD * exchangeRate);

    const refundLabels: Record<string, string> = {
        credit_balance: 'Monedero (Saldo a Favor)',
        cash: 'Efectivo',
        transfer: 'Transferencia',
        usdt: 'USDT',
        none: 'Sin reembolso'
    };
    const typeLabels: Record<string, string> = { full: 'Devolución Total', partial: 'Devolución Parcial' };

    return (
        <div className="flex flex-wrap gap-6 text-xs text-gray-600">
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Tipo</span>
                <span className="text-gray-800">{typeLabels[note?.type] || note?.type}</span>
            </div>
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Método de reembolso</span>
                <span className="text-gray-800">{refundLabels[note?.refund_method] || note?.refund_method}</span>
            </div>
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Monto devuelto</span>
                <span className="text-primary-700 font-semibold">
                    {new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalCOP)}
                </span>
            </div>
            <div>
                <span className="font-medium block text-gray-500 mb-0.5">Tasa aplicada</span>
                <span className="text-gray-800">{exchangeRate.toLocaleString(LOCALE)} COP/USD</span>
            </div>
        </div>
    );
};

interface PaymentDetailExpandedProps {
  transaction: Transaction;
  currency: string;
}

const PaymentDetailExpanded = ({ transaction, currency }: PaymentDetailExpandedProps) => {
    const pay = transaction.original_data;
    const storedCurrency = pay?.currency || 'USD';
    const storedAmount = parseFloat(pay?.amount || 0);
    const storedRate = parseFloat(pay?.exchange_rate || 1);
    const saleRate = parseFloat(pay?.sale?.exchange_rate || 1);

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

    const methodLabels: Record<string, string> = {
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
                    <span className="text-gray-800">{methodLabels[pay?.payment_method] || pay?.payment_method}</span>
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
                        <span className="text-gray-800">{effectiveRate.toLocaleString(LOCALE)} COP/USD</span>
                    </div>
                )}
                {pay?.reference && (
                    <div>
                        <span className="font-medium block text-gray-500 mb-0.5">Referencia</span>
                        <span className="text-gray-800">{pay.reference}</span>
                    </div>
                )}
                {pay?.sale?.sale_number && (
                    <div>
                        <span className="font-medium block text-gray-500 mb-0.5">Abono a</span>
                        <span className="text-gray-800">{pay.sale.sale_number}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

interface StatementCustomer {
  id: number;
  businessName?: string;
  firstName?: string;
  lastName?: string;
}

interface CustomerStatementModalProps {
  customer: StatementCustomer;
  onClose: () => void;
}

const CustomerStatementModal = ({ customer, onClose }: CustomerStatementModalProps) => {
    const { hasPermission } = useAuth();
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statementData, setStatementData] = useState<any>(null);
    const [selectedCurrency, setSelectedCurrency] = useState('COP');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Checkout Modal State (same CheckoutModal as POS/SalesPage)
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [checkoutPaymentLines, setCheckoutPaymentLines] = useState<PaymentLineUtil[]>([]);
    const [checkoutNotes, setCheckoutNotes] = useState('');
    const [collectSaving, setCollectSaving] = useState(false);

    // Exchange rates for CheckoutModal
    const { data: ratesData } = useQuery({
        queryKey: ['exchange-rates'],
        queryFn: () => exchangeRateService.getLatest(),
        staleTime: 5 * 60_000,
    });
    const exchangeRates: ExchangeRate[] = ratesData?.data || [];
    const copPerUSD = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;

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
            .filter((t: Transaction) => t.currency === selectedCurrency)
            .map((t: Transaction) => {
                runningBalance = t.type === 'charge'
                    ? runningBalance + t.amount  // venta: suma deuda
                    : runningBalance - t.amount; // pagos, CN, y uso de saldo a favor: reducen deuda
                return { ...t, runningBalance };
            });
    };

    const handleToggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id);
    };

    const getPendingInCurrency = (transaction: Transaction): number => {
        const rate = parseFloat(transaction.original_data?.exchange_rate || 1);
        const paidUSD = parseFloat(transaction.original_data?.paid_amount || 0);
        const paidInCurrency = selectedCurrency === 'USD' ? paidUSD : paidUSD * rate;
        const cnAmount = selectedCurrency === 'USD'
            ? parseFloat(transaction.original_data?.cn_amount_usd || 0)
            : parseFloat(transaction.original_data?.cn_amount_cop || 0);
        return Math.max(0, transaction.amount - paidInCurrency - cnAmount);
    };

    const handleOpenPaymentModal = (transaction: Transaction) => {
        setCheckoutPaymentLines([]);
        setCheckoutNotes('');
        setSelectedTransaction(transaction);
    };

    const handleCollectPayment = async () => {
        if (checkoutPaymentLines.length === 0) {
            return toast.error('Agrega al menos una forma de pago');
        }
        const t = selectedTransaction;
        if (!t) return;

        const saleId = t.original_data!.id;
        const rate = parseFloat(t.original_data!.exchange_rate) || copPerUSD;
        const remainingUSD = parseFloat(String(t.original_data!.total || 0)) - parseFloat(String(t.original_data!.paid_amount || 0));
        const saleTotalCOP = remainingUSD * rate;

        setCollectSaving(true);
        try {
            const { adjustedLines } = adjustPaymentLinesForChange(
                checkoutPaymentLines, saleTotalCOP, rate, 'COP', COP_TOLERANCE
            );
            const backendLines = convertPaymentLinesToBackend(adjustedLines, exchangeRates, rate);

            await saleService.addPayment(saleId, {
                payment_lines: backendLines,
                notes: checkoutNotes || undefined,
            } as any);

            toast.success('Pago registrado exitosamente');
            setSelectedTransaction(null);

            // Refresh the statement data
            setLoading(true);
            await fetchStatement();
            setLoading(false);

            queryClient.invalidateQueries({ queryKey: ['sales'] });
        } catch (err: unknown) {
            const error = err as any;
            toast.error(error?.response?.data?.message || 'Error al registrar el pago');
        } finally {
            setCollectSaving(false);
        }
    };

    const renderSummaryCard = (title: string, amount: number, currency: string, bgColor: string, textColor: string, Icon: React.ElementType) => (
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
                                <CircleNotch className="h-10 w-10 text-teal-600 animate-spin mb-4" />
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
                                                Number(statementData.summary[selectedCurrency].total_invoiced),
                                                selectedCurrency,
                                                'bg-primary-50',
                                                'text-primary-800',
                                                Receipt
                                            )}
                                            {renderSummaryCard(
                                                'Total Pagado (Histórico)',
                                                Number(statementData.summary[selectedCurrency].total_paid),
                                                selectedCurrency,
                                                'bg-teal-50',
                                                'text-teal-800',
                                                ArrowUpRight
                                            )}
                                            {renderSummaryCard(
                                                'Saldo Pendiente',
                                                Math.max(0, Number(statementData.summary[selectedCurrency].balance)),
                                                selectedCurrency,
                                                statementData.summary[selectedCurrency].balance > 0 ? 'bg-orange-50' : 'bg-gray-100',
                                                statementData.summary[selectedCurrency].balance > 0 ? 'text-orange-800' : 'text-gray-600',
                                                ArrowDownRight
                                            )}
                                            {renderSummaryCard(
                                                'Saldo a Favor',
                                                Number(statementData.summary[selectedCurrency].available_credit),
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
                                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                                No se encontraron transacciones en {selectedCurrency}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        getFilteredLedger().map((t: Transaction) => {
                                                            const isExpanded = expandedId === t.id;
                                                            const isCharge = t.type === 'charge';
                                                            const expandBg = isCharge ? 'bg-orange-50/60' : 'bg-green-50/60';
                                                            const expandBorder = isCharge ? 'border-orange-100' : 'border-green-100';

                                                            return (
                                                                <React.Fragment key={t.id}>
                                                                    <tr className={`transition-colors ${isExpanded ? (isCharge ? 'bg-orange-50/30' : 'bg-green-50/30') : 'hover:bg-teal-50/50'}`}>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                                            {formatDateShort(t.date)}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                                            <div className="flex items-center gap-2">
                                                                                <button
                                                                                    onClick={() => handleToggleExpand(t.id)}
                                                                                    className="flex items-center gap-1.5 text-teal-700 hover:text-teal-900 hover:underline font-semibold transition-colors"
                                                                                    title="Ver detalle"
                                                                                >
                                                                                    {isExpanded
                                                                                        ? <CaretDown className="w-3.5 h-3.5 flex-shrink-0" />
                                                                                        : <CaretRight className="w-3.5 h-3.5 flex-shrink-0" />
                                                                                    }
                                                                                    {t.reference || '-'}
                                                                                </button>
                                                                                {isCharge && hasPermission('sales.collect') && t.original_data?.status !== 'completed' && (parseFloat(t.original_data?.total || 0) - parseFloat(t.original_data?.paid_amount || 0)) > 0.01 && (
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
                                                                                    t.type === 'credit' ? 'text-primary-600' :
                                                                                        t.isInternal ? 'text-purple-600' : 'text-green-600'
                                                                                    }`}>
                                                                                    {t.type === 'charge'
                                                                                        ? (t.original_data?.sale_type === 'cash' ? 'Venta Contado' : t.original_data?.sale_type === 'pos_pending' ? 'Pendiente de Cobro' : 'Nota de Débito (Venta)')
                                                                                        : t.type === 'credit' ? 'Nota de Crédito (Devolución)'
                                                                                            : t.isInternal ? 'Uso de Saldo a Favor' : 'Pago Recibido'}
                                                                                </span>
                                                                                <span className="text-xs text-gray-500">{t.description}</span>
                                                                                {t.original_currency && t.original_currency !== selectedCurrency && (
                                                                                    <span className="text-[10px] text-gray-400 font-medium">
                                                                                        Original: {formatCurrency(t.original_amount || 0, t.original_currency)}
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
                                                                                        <span className="text-primary-500 text-[10px]">NC: -{formatCurrency(cnAmt, t.currency)}</span>
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
                                                                                <span className={t.isInternal ? "text-purple-600" : (t.type === 'credit' ? 'text-primary-600' : "text-green-600")}>
                                                                                    {formatCurrency(t.amount, t.currency)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-gray-300">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">
                                                                            <span className={
                                                                                (t.runningBalance || 0) > 0.009
                                                                                    ? 'text-red-600'
                                                                                    : (t.runningBalance || 0) < -0.009
                                                                                        ? 'text-green-600'
                                                                                        : 'text-gray-400'
                                                                            }>
                                                                                {formatCurrency(Math.abs(t.runningBalance || 0), t.currency)}
                                                                                {(t.runningBalance || 0) < -0.009 && (
                                                                                    <span className="block text-[10px] font-normal">a favor</span>
                                                                                )}
                                                                            </span>
                                                                        </td>
                                                                    </tr>

                                                                    {isExpanded && (
                                                                        <tr className={expandBg}>
                                                                            <td colSpan={6} className={`px-8 py-4 border-t ${expandBorder}`}>
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

            {/* Checkout Modal (same as POS / SalesPage) */}
            {selectedTransaction && (() => {
                const rate = parseFloat(selectedTransaction.original_data?.exchange_rate) || copPerUSD;
                const remainingUSD = Math.max(0,
                    parseFloat(String(selectedTransaction.original_data?.total || 0))
                    - parseFloat(String(selectedTransaction.original_data?.paid_amount || 0))
                );
                const saleType = selectedTransaction.original_data?.sale_type || 'credit';
                return (
                    <CheckoutModal
                        show={!!selectedTransaction}
                        onClose={() => !collectSaving && setSelectedTransaction(null)}
                        subtotal={remainingUSD}
                        discount={0}
                        tax={0}
                        total={remainingUSD}
                        totalCOP={remainingUSD * rate}
                        copPerUSD={rate}
                        paymentLines={checkoutPaymentLines}
                        setPaymentLines={setCheckoutPaymentLines as React.Dispatch<React.SetStateAction<PaymentLine[]>>}
                        customer={null}
                        onCustomerSelect={null}
                        saleType={saleType === 'pos_pending' ? 'cash' : saleType}
                        notes={checkoutNotes}
                        setNotes={setCheckoutNotes}
                        exchangeRates={exchangeRates}
                        displayCurrency="COP"
                        onComplete={handleCollectPayment}
                        saving={collectSaving}
                        isAdmin={false}
                        mode="collect"
                        allowCredit={false}
                        title={saleType === 'pos_pending'
                            ? `Cobrar Venta — ${selectedTransaction.reference}`
                            : `Abonar Pago — ${selectedTransaction.reference}`}
                        confirmLabel={saleType === 'pos_pending' ? 'Cobrar' : 'Registrar Abono'}
                    />
                );
            })()}
        </div>
    );
};

export default CustomerStatementModal;
