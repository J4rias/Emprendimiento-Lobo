import { useState, useEffect } from 'react';
import { saleService } from '../services/api/saleService';
import { userService } from '../services/api/userService';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { printHTML, formatDate as printFormatDate } from '../utils/printUtils';
import { Calendar, Printer, CurrencyDollar, Wallet, Users, WarningCircle, CreditCard, ShoppingCart, ArrowCounterClockwise } from '@phosphor-icons/react';
import { toast } from 'sonner';

const DailyReportPage = () => {
    const { user, hasPermission } = useAuth();
    const { companySettings } = useCompany();

    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [users, setUsers] = useState([]);

    const [filters, setFilters] = useState({
        date: new Date().toISOString().split('T')[0],
        user_id: user?.role?.name === 'Administrador' ? '' : (user?.id || '')
    });

    useEffect(() => {
        if (hasPermission('users.view')) {
            loadUsers();
        }
    }, []);

    useEffect(() => {
        loadReport();
    }, [filters]);

    const loadUsers = async () => {
        try {
            const response = await userService.getActive();
            setUsers(response.data || []);
        } catch (err) {
            console.error('Error loading users:', err);
        }
    };

    const loadReport = async () => {
        try {
            setLoading(true);
            const res = await saleService.getDailyClosure(filters);
            setReport(res);
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar el reporte de caja.');
        } finally {
            setLoading(false);
        }
    };

    const getMethodLabel = (method) => {
        const methods = {
            cash: 'Efectivo',
            card: 'Punto de venta',
            transfer: 'Transferencia',
            usdt: 'USDT'
        };
        return methods[method] || method;
    };

    const fmtAmount = (amount, currency = 'USD') => {
        const val = parseFloat(amount || 0);
        if (currency === 'COP') return Math.round(val).toLocaleString('de-DE');
        return val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const handlePrint = () => {
        if (!report) return;
        const selectedUser = filters.user_id ? users.find(u => String(u.id) === String(filters.user_id)) : null;
        const userName = selectedUser ? (selectedUser.name || `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim()) : 'Todos';

        const breakdownRows = Object.entries(report.paymentsBreakdown || {}).map(([currency, methods]) => {
            const methodRows = Object.entries(methods).map(([method, amount]) =>
                `<tr>
                    <td style="padding:3px 0; font-size:12px;">${getMethodLabel(method)}</td>
                    <td style="padding:3px 0; text-align:right; font-size:12px; font-weight:bold;">${currency === 'USD' ? '$ ' : ''}${fmtAmount(amount, currency)}</td>
                </tr>`
            ).join('');
            const total = Object.values(methods).reduce((a, b) => a + b, 0);
            return `
                <div style="margin-bottom:8px;">
                    <div style="font-weight:bold; font-size:13px; border-bottom:1px solid #000; padding-bottom:2px; margin-bottom:4px;">
                        ${currency}
                    </div>
                    <table style="width:100%; border-collapse:collapse;">
                        ${methodRows}
                        <tr style="border-top:1px dashed #000;">
                            <td style="padding:3px 0; font-size:12px; font-weight:bold;">Total ${currency}</td>
                            <td style="padding:3px 0; text-align:right; font-size:13px; font-weight:bold;">${currency === 'USD' ? '$ ' : ''}${fmtAmount(total, currency)}</td>
                        </tr>
                    </table>
                </div>`;
        }).join('');

        const html = `
            <div style="width:100%; font-family:Arial,Helvetica,sans-serif; font-size:13px; line-height:1.2; color:#000;">
                <div style="text-align:center; font-weight:bold; font-size:16px; margin-bottom:4px;">ARQUEO DE CAJA</div>
                <div style="text-align:center; font-size:11px; margin-bottom:8px;">${report.date}</div>
                <div style="border-top:1px dashed #000; margin:6px 0;"></div>
                <div style="font-size:12px; margin-bottom:2px;"><strong>Cajero:</strong> ${userName}</div>
                <div style="font-size:12px; margin-bottom:8px;"><strong>Impreso:</strong> ${printFormatDate(new Date())}</div>
                <div style="border-top:1px dashed #000; margin:6px 0;"></div>
                <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
                    <tr>
                        <td style="font-size:13px; font-weight:bold;">Ventas Totales</td>
                        <td style="text-align:right; font-size:15px; font-weight:bold;">COP ${fmtAmount(report.totalSalesCOP || 0, 'COP')}</td>
                    </tr>
                    <tr>
                        <td style="font-size:13px;">Operaciones</td>
                        <td style="text-align:right; font-size:13px; font-weight:bold;">${report.salesCount || 0}</td>
                    </tr>
                </table>
                <div style="border-top:1px dashed #000; margin:6px 0;"></div>
                <div style="font-weight:bold; font-size:14px; text-align:center; margin-bottom:8px;">DESGLOSE POR MONEDA</div>
                ${breakdownRows || '<div style="text-align:center; font-size:11px;">Sin pagos registrados</div>'}
                <div style="border-top:1px dashed #000; margin:8px 0;"></div>
                ${(report.cashRefunds?.refund_count > 0) ? `
                <div style="font-weight:bold; font-size:14px; text-align:center; margin-bottom:8px;">DEVOLUCIONES EN EFECTIVO</div>
                <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
                    <tr>
                        <td style="font-size:12px;">Cantidad</td>
                        <td style="text-align:right; font-size:12px; font-weight:bold;">${report.cashRefunds.refund_count}</td>
                    </tr>
                    ${Object.entries(report.cashRefunds.refund_by_currency || {}).filter(([, v]) => v > 0).map(([cur, amt]) => `
                    <tr>
                        <td style="font-size:12px;">Total ${cur}</td>
                        <td style="text-align:right; font-size:12px; font-weight:bold;">${cur === 'USD' ? '$ ' : ''}${fmtAmount(amt, cur)}</td>
                    </tr>`).join('')}
                </table>
                <div style="border-top:1px dashed #000; margin:8px 0;"></div>
                ` : ''}
                <div style="font-weight:bold; font-size:14px; text-align:center; margin-bottom:8px;">CUADRE FÍSICO (EFECTIVO)</div>
                <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
                    ${(() => {
                        const refundMap = report.cashRefunds?.refund_by_currency || {};
                        return Object.entries(report.paymentsBreakdown || {})
                            .map(([currency, methods]) => {
                                const cash = methods.cash || 0;
                                const refund = refundMap[currency] || 0;
                                return [currency, cash - refund];
                            })
                            .filter(([, amount]) => amount !== 0)
                            .map(([currency, amount]) =>
                                `<tr>
                                    <td style="font-size:13px; font-weight:bold;">${currency}</td>
                                    <td style="text-align:right; font-size:15px; font-weight:bold;">${fmtAmount(amount, currency)}</td>
                                </tr>`
                            ).join('');
                    })()}
                </table>
                ${(() => {
                    const usdtTotal = Object.values(report.paymentsBreakdown || {})
                        .reduce((sum, methods) => sum + (methods.usdt || 0), 0);
                    if (!usdtTotal) return '';
                    return `<div style="font-weight:bold; font-size:12px; margin-bottom:4px;">USDT recibido</div>
                    <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
                        <tr><td style="font-size:13px; font-weight:bold;">USDT</td><td style="text-align:right; font-size:15px; font-weight:bold;">$ ${fmtAmount(usdtTotal, 'USD')}</td></tr>
                    </table>`;
                })()}
                <div style="border-top:1px dashed #000; margin:8px 0;"></div>
                <div style="text-align:center; font-size:10px; margin-top:6px;">*** FIN DE ARQUEO ***</div>
            </div>`;

        printHTML(html, `Arqueo ${report.date}`);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Cierre de Caja</h1>
                    <p className="text-gray-500 text-sm mt-1">Resumen diario de ventas y cuadre multi-moneda</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {hasPermission('users.view') && (
                        <select
                            value={filters.user_id}
                            onChange={e => setFilters(f => ({ ...f, user_id: e.target.value }))}
                            className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-200 w-full md:w-48"
                        >
                            <option value="">Todos los cajeros</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                    )}

                    <input
                        type="date"
                        value={filters.date}
                        onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
                        className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-200 w-full md:w-auto"
                    />

                    <button
                        onClick={handlePrint}
                        disabled={loading || !report}
                        className="w-full md:w-auto px-4 py-2 bg-slate-800 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-slate-700 disabled:bg-slate-300"
                    >
                        <Printer className="w-4 h-4" />
                        Imprimir Arqueo
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
            ) : !report ? (
                <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
                    No hay datos para mostrar.
                </div>
            ) : (
                <div className="space-y-6 print-container">

                    {/* Totales recibidos por moneda */}
                    {(() => {
                        const currencyTotals = Object.entries(report.paymentsBreakdown || {}).map(([currency, methods]) => {
                            const total = Object.entries(methods)
                                .filter(([k]) => k !== '_salesCount')
                                .reduce((sum, [, amount]) => sum + amount, 0);
                            return [currency, total];
                        }).filter(([, total]) => total > 0);

                        const iconStyles = {
                            USD: 'bg-emerald-100 text-emerald-600',
                            COP: 'bg-blue-100 text-blue-600',
                            VES: 'bg-amber-100 text-amber-600'
                        };
                        return currencyTotals.length > 0 ? (
                            <div className={`grid grid-cols-1 ${currencyTotals.length >= 3 ? 'md:grid-cols-3' : currencyTotals.length === 2 ? 'md:grid-cols-2' : ''} gap-4`}>
                                {currencyTotals.map(([currency, total]) => (
                                    <div key={currency} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                        <div className={`p-4 rounded-lg ${iconStyles[currency] || 'bg-gray-100 text-gray-600'}`}>
                                            <CurrencyDollar className="w-8 h-8" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Recibido {currency}</p>
                                            <div className="text-3xl font-bold text-gray-900 mt-1">
                                                {currency === 'USD' ? '$ ' : ''}{fmtAmount(total, currency)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null;
                    })()}

                    {/* Ventas del dia, operaciones, credito otorgado, cobros de credito */}
                    {(() => {
                        const hasCredit = report.creditTotalUSD > 0;
                        const creditCollected = report.creditCollectedByCurrency || {};
                        const hasCreditCollections = Object.keys(creditCollected).length > 0;
                        const hasRefunds = report.cashRefunds?.refund_count > 0;
                        const cardCount = 2 + (hasCredit ? 1 : 0) + (hasCreditCollections ? 1 : 0) + (hasRefunds ? 1 : 0);
                        const gridCols = cardCount >= 4 ? 'md:grid-cols-4' : cardCount === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

                        return (
                        <div className={`grid grid-cols-1 ${gridCols} gap-4`}>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="p-4 bg-indigo-100 rounded-lg text-indigo-600">
                                    <ShoppingCart className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Ventas del Dia</p>
                                    <div className="text-2xl font-bold text-gray-900 mt-1">
                                        $ {fmtAmount(report.totalSalesUSD || 0, 'USD')}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">COP {fmtAmount(report.totalSalesCOP || 0, 'COP')}</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="p-4 bg-blue-100 rounded-lg text-blue-600">
                                    <Wallet className="w-8 h-8" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Operaciones</p>
                                    <div className="text-2xl font-bold text-gray-900 mt-1">
                                        {report.salesCount || 0}
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">Facturas procesadas</p>
                                </div>
                            </div>

                            {hasCredit && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                    <div className="p-4 bg-orange-100 rounded-lg text-orange-600">
                                        <CreditCard className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Credito Otorgado</p>
                                        <div className="text-2xl font-bold text-gray-900 mt-1">
                                            $ {fmtAmount(report.creditTotalUSD, 'USD')}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">Pendiente por cobrar</p>
                                    </div>
                                </div>
                            )}

                            {hasCreditCollections && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                                    <div className="p-4 bg-teal-100 rounded-lg text-teal-600">
                                        <CurrencyDollar className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Cobros de Credito</p>
                                        <div className="mt-1 space-y-0.5">
                                            {Object.entries(creditCollected).map(([currency, amount]) => (
                                                <div key={currency} className="text-xl font-bold text-gray-900">
                                                    {currency === 'USD' ? '$ ' : ''}{fmtAmount(amount, currency)} {currency}
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">Abonos recibidos hoy</p>
                                    </div>
                                </div>
                            )}

                            {hasRefunds && (
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-rose-200 flex items-center gap-4">
                                    <div className="p-4 bg-rose-100 rounded-lg text-rose-600">
                                        <ArrowCounterClockwise className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Devoluciones</p>
                                        <div className="text-2xl font-bold text-rose-600 mt-1">
                                            {Object.entries(report.cashRefunds.refund_by_currency || {}).filter(([, v]) => v > 0).map(([cur, amt]) => `${cur === 'USD' ? '$ ' : ''}${fmtAmount(amt, cur)} ${cur}`).join(' / ') || `$ ${fmtAmount(report.cashRefunds.refund_usd, 'USD')}`}
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {report.cashRefunds.refund_count} devoluci{report.cashRefunds.refund_count !== 1 ? 'ones' : 'on'} en efectivo
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        );
                    })()}

                    {/* Desglose de Caja Fuerte (Multimoneda) */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-slate-50">
                            <h2 className="text-lg font-semibold text-gray-800">Desglose Físico en Caja</h2>
                            <p className="text-sm text-gray-500 mt-1">Sumatoria exacta por divisa de pagos ingresados hoy.</p>
                        </div>

                        <div className="p-6">
                            {Object.keys(report.paymentsBreakdown || {}).length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <WarningCircle className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                    No se registraron pagos finalizados para esta fecha.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {Object.entries(report.paymentsBreakdown).map(([currency, methods]) => {
                                        const salesCount = methods._salesCount || 0;
                                        const paymentMethods = Object.entries(methods).filter(([k]) => k !== '_salesCount');
                                        return (
                                        <div key={currency} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-slate-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                                <span className="font-bold text-slate-700">Recibido en {currency}</span>
                                                {salesCount > 0 && <span className="text-xs text-slate-500">{salesCount} venta{salesCount !== 1 ? 's' : ''}</span>}
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {paymentMethods.map(([method, amount]) => (
                                                    <div key={method} className="flex justify-between items-center px-4 py-3 hover:bg-slate-50">
                                                        <span className="text-sm text-gray-600">{getMethodLabel(method)}</span>
                                                        <span className="font-semibold text-gray-900">
                                                            {currency === 'USD' ? '$' : ''}
                                                            {amount.toLocaleString('de-DE', { minimumFractionDigits: currency === 'COP' ? 0 : 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="bg-slate-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center text-sm font-bold">
                                                <span className="text-slate-600">Total {currency}:</span>
                                                <span className="text-slate-900">
                                                    {paymentMethods.reduce((a, [, b]) => a + b, 0).toLocaleString('de-DE', { minimumFractionDigits: currency === 'COP' ? 0 : 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cuadre Físico — solo efectivo por moneda, menos devoluciones */}
                    {(() => {
                        const refundMap = report.cashRefunds?.refund_by_currency || {};
                        const cashByCurrency = Object.entries(report.paymentsBreakdown || {})
                            .map(([currency, methods]) => {
                                const cash = methods.cash || 0;
                                const refund = refundMap[currency] || 0;
                                return [currency, cash - refund];
                            })
                            .filter(([, amount]) => amount !== 0);
                        // USDT total across all currencies
                        const usdtTotal = Object.values(report.paymentsBreakdown || {})
                            .reduce((sum, methods) => sum + (methods.usdt || 0), 0);
                        const hasAnyRefund = Object.values(refundMap).some(v => v > 0);
                        if (cashByCurrency.length === 0 && !hasAnyRefund && !usdtTotal) return null;
                        return (
                            <div className="bg-slate-800 text-white p-6 rounded-xl shadow-sm">
                                <p className="text-sm font-medium text-slate-300 uppercase tracking-wide mb-3">Cuadre Físico (Efectivo)</p>
                                <div className="flex flex-wrap justify-between gap-4">
                                    {cashByCurrency.map(([currency, amount]) => (
                                        <div key={currency}>
                                            <p className="text-xs text-slate-400">{currency}</p>
                                            <p className="text-2xl font-bold">
                                                {fmtAmount(amount, currency)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                {usdtTotal > 0 && (
                                    <div className="mt-4 pt-3 border-t border-slate-600">
                                        <p className="text-xs text-cyan-300 uppercase tracking-wide mb-1">USDT recibido</p>
                                        <p className="text-xl font-bold text-cyan-200">$ {fmtAmount(usdtTotal, 'USD')}</p>
                                    </div>
                                )}
                                {hasAnyRefund && (
                                    <p className="text-xs text-slate-400 mt-2">
                                        Incluye descuento por devoluciones: {Object.entries(refundMap).filter(([, v]) => v > 0).map(([cur, amt]) => `${cur === 'USD' ? '$ ' : ''}${fmtAmount(amt, cur)} ${cur}`).join(' / ')}
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                </div>
            )}
        </div>
    );
};

export default DailyReportPage;
