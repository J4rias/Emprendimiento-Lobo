import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowCounterClockwise, FileX } from '@phosphor-icons/react';
import { creditNoteService } from '../../services/api/creditNoteService';
import { Modal } from '../ui';
import { toast } from 'sonner';

interface SaleCustomer {
  business_name?: string;
  businessName?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  [key: string]: unknown;
}

interface SaleDetailItem {
  id: number;
  product?: { name: string };
  presentation?: { name: string; units_per_package?: number };
  quantity: string | number;
  unit_price: string | number;
  is_unit?: boolean;
  [key: string]: unknown;
}

interface SaleData {
  id: number;
  sale_number: string;
  customer_id?: number;
  customer?: SaleCustomer;
  total: string | number;
  exchange_rate?: number;
  details?: SaleDetailItem[];
  [key: string]: unknown;
}

interface ReturnItem extends SaleDetailItem {
  returnQuantity: number;       // For is_unit=true: units to return. For is_unit=false: packages to return
  looseQuantity: number;        // For is_unit=false only: individual loose units to return
  maxQuantity: number;          // Max packages (or units for is_unit=true)
  maxLooseUnits: number;        // Max loose units returnable (total units in remaining packages)
  originalQuantity: number;
  alreadyReturned: number;
}

interface SaleReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleData | null;
  onReturnSuccess: () => void;
}

const SaleReturnModal: React.FC<SaleReturnModalProps> = ({ isOpen, onClose, sale, onReturnSuccess }) => {
    const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
    const [reason, setReason] = useState('return');
    const [reasonDescription, setReasonDescription] = useState('');
    const [refundMethod, setRefundMethod] = useState('credit_balance');
    const [returnExchangeRate, setReturnExchangeRate] = useState<number>(0);
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Initialize return items — subtract already returned quantities
    useEffect(() => {
        if (!isOpen || !sale || !sale.details) return;

        const initItems = async () => {
            // Build map of already returned units per sale_detail_id
            const returnedMap: Record<number, number> = {};
            // Build is_unit lookup from sale details
            const isUnitMap: Record<number, boolean | undefined> = {};
            for (const detail of sale.details!) {
                isUnitMap[detail.id] = detail.is_unit;
            }

            try {
                const cn = await creditNoteService.getAll({ sale_id: sale.id, status: 'applied', limit: 100 });
                for (const note of (cn.data || []) as Array<{ details?: Array<Record<string, unknown>> }>) {
                    for (const d of (note.details || []) as Array<{ sale_detail_id: number; presentation?: { units_per_package?: number }; package_quantity_returned: number; loose_units_returned?: number }>) {
                        const uph = d.presentation?.units_per_package || 1;
                        const effectiveUph = isUnitMap[d.sale_detail_id] ? 1 : uph;
                        const units = d.package_quantity_returned + ((d.loose_units_returned || 0) / effectiveUph);
                        returnedMap[d.sale_detail_id] = (returnedMap[d.sale_detail_id] || 0) + units;
                    }
                }
            } catch (_) { /* ignore, fallback to original qty */ }

            const items = sale.details!.map(detail => {
                const originalQty = parseFloat(String(detail.quantity));
                const alreadyReturned = returnedMap[detail.id] || 0;
                const available = Math.max(0, originalQty - alreadyReturned);
                const uph = detail.presentation?.units_per_package || 1;
                const isUnit = detail.is_unit !== false;
                // For packages: max loose = total available base units (packages * uph)
                const maxLoose = isUnit ? 0 : available * uph;
                return {
                    ...detail,
                    returnQuantity: 0,
                    looseQuantity: 0,
                    maxQuantity: available,
                    maxLooseUnits: maxLoose,
                    originalQuantity: originalQty,
                    alreadyReturned
                };
            });
            setReturnItems(items);
            setReason('return');
            setReasonDescription('');
            setRefundMethod(sale.customer_id ? 'credit_balance' : 'cash');
            setReturnExchangeRate(sale.exchange_rate || 1);
        };

        initItems();
    }, [isOpen, sale]);

    const handleQuantityChange = (id: number, value: string) => {
        const qty = parseFloat(value) || 0;
        setReturnItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const clamped = Math.min(Math.max(0, qty), item.maxQuantity);
            const isUnit = item.is_unit !== false;
            if (!isUnit) {
                // Clamp loose units: total base units can't exceed maxLooseUnits
                const uph = item.presentation?.units_per_package || 1;
                const maxLooseNow = item.maxLooseUnits - clamped * uph;
                const clampedLoose = Math.min(item.looseQuantity, Math.max(0, maxLooseNow));
                return { ...item, returnQuantity: clamped, looseQuantity: clampedLoose };
            }
            return { ...item, returnQuantity: clamped };
        }));
    };

    const handleLooseQuantityChange = (id: number, value: string) => {
        const qty = Math.floor(parseFloat(value) || 0);
        setReturnItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const uph = item.presentation?.units_per_package || 1;
            const maxLooseNow = item.maxLooseUnits - item.returnQuantity * uph;
            const clamped = Math.min(Math.max(0, qty), Math.max(0, maxLooseNow));
            return { ...item, looseQuantity: clamped };
        }));
    };

    const handleSetMax = (id: number) => {
        setReturnItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            return { ...item, returnQuantity: item.maxQuantity, looseQuantity: 0 };
        }));
    };

    // Calculate totals for the preview
    const calculateTotals = () => {
        let subtotal = 0;
        returnItems.forEach(item => {
            const unitPrice = parseFloat(String(item.unit_price));
            const isUnit = item.is_unit !== false;
            if (isUnit) {
                if (item.returnQuantity > 0) subtotal += unitPrice * item.returnQuantity;
            } else {
                // Package: unit_price is per-package, loose units priced proportionally
                const uph = item.presentation?.units_per_package || 1;
                const pkgTotal = unitPrice * item.returnQuantity;
                const looseTotal = (unitPrice / uph) * item.looseQuantity;
                subtotal += pkgTotal + looseTotal;
            }
        });

        // Check if it's a full return (all packages returned, no loose remainder)
        const isFullReturn = returnItems.every(item =>
            item.returnQuantity === item.maxQuantity && item.looseQuantity === 0
        );

        const finalTotal = isFullReturn ? (parseFloat(String(sale?.total || 0))) : subtotal;

        return {
            subtotal,
            total: finalTotal,
            isFullReturn
        };
    };

    const totals = calculateTotals();
    const needsRate = refundMethod === 'cash' || refundMethod === 'transfer';
    const COP_RATE = needsRate ? (returnExchangeRate || 1) : (sale?.exchange_rate || 1);

    const formatCurrency = (val: number): string => {
        return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(val * COP_RATE));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0 || item.looseQuantity > 0);

        if (itemsToReturn.length === 0) {
            toast.error('Debe especificar al menos un producto a devolver');
            return;
        }

        const isConsumidorFinal = !sale?.customer_id;

        if (isConsumidorFinal && refundMethod === 'credit_balance') {
            toast.error('El Consumidor Final no tiene monedero. Seleccione otro método de reembolso.');
            return;
        }

        setServerError(null);
        setSubmitting(true);
        try {
            const payload = {
                sale_id: sale!.id,
                reason,
                reason_description: reasonDescription,
                type: totals.isFullReturn ? 'full' : 'partial',
                refund_method: isConsumidorFinal ? (refundMethod === 'credit_balance' ? 'none' : refundMethod) : refundMethod,
                exchange_rate: returnExchangeRate,
                items: itemsToReturn.map(item => {
                    const isUnit = item.is_unit !== false;
                    return {
                        sale_detail_id: item.id,
                        package_quantity_returned: isUnit ? item.returnQuantity : item.returnQuantity,
                        loose_units_returned: isUnit ? 0 : item.looseQuantity,
                        return_to_stock: true
                    };
                })
            };

            const result = await creditNoteService.create(payload);

            // Auto-approve to make it instant for the user (standard POS workflow)
            await creditNoteService.approve(result.data.id);

            toast.success('Devolución procesada exitosamente');
            onReturnSuccess();
        } catch (error) {
            console.error('Error creating credit note:', error);
            const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
            const serverMsg = err.response?.data?.error || err.response?.data?.message || err.message;
            setServerError(serverMsg ?? null);
            toast.error(`Error: ${serverMsg}`, { duration: 8000 });
        } finally {
            setSubmitting(false);
        }
    };

    if (!sale) return null;

    return (
        <Modal
            open={isOpen}
            onClose={() => !submitting && onClose()}
            title={
                <div className="flex items-center gap-2 text-rose-600">
                    <ArrowCounterClockwise className="w-5 h-5" />
                    <span>Generar Devolución - Venta {sale.sale_number}</span>
                </div>
            }
            size="2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Info Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Cliente</p>
                        <p className="text-sm font-medium text-gray-900">
                            {sale.customer
                                ? (sale.customer.business_name || sale.customer.businessName
                                    || `${sale.customer.first_name || sale.customer.firstName || ''} ${sale.customer.last_name || sale.customer.lastName || ''}`.trim()
                                    || 'Consumidor Final')
                                : 'Consumidor Final'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Venta</p>
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(parseFloat(String(sale.total)))}</p>
                    </div>
                    <div className="md:col-span-2">
                        <p className="text-xs font-semibold text-rose-600 uppercase">Importante</p>
                        <p className="text-xs text-rose-700">Las devoluciones reintegrarán el stock físico al almacén de forma inmediata.</p>
                    </div>
                </div>

                {/* Items Table */}
                <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-gray-500" />
                        Productos a devolver
                    </h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Vendidos</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-primary-600 uppercase bg-primary-50/50">CANT. A DEVOLVER</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal (COP)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {returnItems.map(item => {
                                    const isUnit = item.is_unit !== false;
                                    const uph = item.presentation?.units_per_package || 1;
                                    const hasReturn = item.returnQuantity > 0 || item.looseQuantity > 0;
                                    const unitPrice = parseFloat(String(item.unit_price));
                                    const rowSubtotal = isUnit
                                        ? unitPrice * item.returnQuantity
                                        : unitPrice * item.returnQuantity + (unitPrice / uph) * item.looseQuantity;

                                    return (
                                    <tr key={item.id} className={hasReturn ? 'bg-rose-50/30' : ''}>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-gray-900">{item.product?.name}</div>
                                            <div className="text-xs text-gray-500">{item.presentation?.name || 'Unidad'} - {formatCurrency(unitPrice)} / c.u.</div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-600 font-medium">
                                            {item.originalQuantity ?? item.maxQuantity}
                                            {!isUnit && <div className="text-xs text-gray-400">({(item.originalQuantity ?? item.maxQuantity) * uph} uds)</div>}
                                            {item.alreadyReturned > 0 && (
                                                <div className="text-xs text-orange-500">({item.alreadyReturned} devueltos)</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 bg-primary-50/20 text-center">
                                            {isUnit ? (
                                                /* Unit item: single input */
                                                <div className="flex items-center justify-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={item.maxQuantity}
                                                        step="1"
                                                        value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                        placeholder="0"
                                                        data-testid="quantity-input"
                                                        className="w-20 px-2 py-1 text-center border border-primary-300 rounded focus:ring-2 focus:ring-primary-200 bg-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSetMax(item.id)}
                                                        className="text-xs px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded border border-gray-200"
                                                        title="Devolver todo este ítem"
                                                    >
                                                        Max
                                                    </button>
                                                </div>
                                            ) : (
                                                /* Package item: two inputs — packages + loose units */
                                                <div className="space-y-1">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.maxQuantity}
                                                            step="1"
                                                            value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                                                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                            placeholder="0"
                                                            data-testid="packages-input"
                                                            className="w-16 px-2 py-1 text-center border border-primary-300 rounded focus:ring-2 focus:ring-primary-200 bg-white"
                                                        />
                                                        <span className="text-xs text-gray-500">bultos</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSetMax(item.id)}
                                                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded border border-gray-200"
                                                            title="Devolver todo este ítem"
                                                        >
                                                            Max
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={Math.max(0, item.maxLooseUnits - item.returnQuantity * uph)}
                                                            step="1"
                                                            value={item.looseQuantity === 0 ? '' : item.looseQuantity}
                                                            onChange={(e) => handleLooseQuantityChange(item.id, e.target.value)}
                                                            placeholder="0"
                                                            data-testid="loose-input"
                                                            className="w-16 px-2 py-1 text-center border border-orange-300 rounded focus:ring-2 focus:ring-orange-200 bg-white"
                                                        />
                                                        <span className="text-xs text-orange-600">uds sueltas</span>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-medium text-rose-600">
                                            {hasReturn ? formatCurrency(rowSubtotal) : '-'}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Configuration */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Motivo de Devolución
                            </label>
                            <select
                                required
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-rose-500 focus:border-rose-500"
                            >
                                <option value="return">Cliente devolvió la mercancía</option>
                                <option value="error">Error en facturación / sistema</option>
                                <option value="discount">Descuento posterior a venta</option>
                                <option value="other">Otro motivo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Observaciones
                            </label>
                            <textarea
                                rows={2}
                                value={reasonDescription}
                                onChange={(e) => setReasonDescription(e.target.value)}
                                placeholder="Detalle brevemente por qué se anula o devuelve..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-rose-500 focus:border-rose-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                ¿Qué hacer con el dinero?
                            </label>
                            <select
                                required
                                value={refundMethod}
                                onChange={(e) => setRefundMethod(e.target.value)}
                                className="w-full px-3 py-2 border border-primary-300 rounded-md focus:ring-primary-200 focus:border-primary-500 font-medium text-primary-900 bg-primary-50"
                            >
                                <option value="credit_balance" disabled={!sale?.customer_id}>💰 Monedero (Saldo a Favor del Cliente){!sale?.customer_id ? ' — N/A Consumidor Final' : ''}</option>
                                <option value="cash">💵 Entregar Efectivo Físico</option>
                                <option value="transfer">🏦 Pago Móvil / Transferencia</option>
                                <option value="none">❌ Nada (Solo cuadre de inventario/error)</option>
                            </select>
                        </div>

                        {/* Exchange rate — shown for cash/transfer refunds */}
                        {needsRate && (
                            <div>
                                <label htmlFor="return-exchange-rate" className="block text-sm font-medium text-gray-700 mb-1">
                                    Tasa de cambio (COP por 1 USD)
                                </label>
                                <input
                                    id="return-exchange-rate"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={returnExchangeRate || ''}
                                    onChange={(e) => setReturnExchangeRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Ej: 4200"
                                    className="w-full px-3 py-2 border border-primary-300 rounded-md focus:ring-primary-200 focus:border-primary-500 bg-white"
                                />
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span className="text-gray-800">Monto a devolver:</span>
                                <span className="text-rose-600">USD {totals.total.toFixed(2)}</span>
                            </div>
                            {needsRate && returnExchangeRate > 0 && (
                                <div className="flex justify-between items-center text-base font-semibold mt-1">
                                    <span className="text-gray-600">Equivalente COP:</span>
                                    <span className="text-rose-500">{formatCurrency(totals.total)}</span>
                                </div>
                            )}
                            <p className="text-xs text-gray-500 text-right mt-1">
                                {totals.isFullReturn ? 'Devolución Total' : 'Devolución Parcial'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Server error display */}
                {serverError && (
                    <div className="p-3 bg-red-50 border border-red-300 rounded-md text-sm text-red-800 font-mono break-all">
                        <strong>Error del servidor:</strong> {serverError}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={submitting || totals.total <= 0}
                        className="px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 disabled:opacity-50 flex items-center gap-2 font-medium"
                    >
                        {submitting ? (
                            <>
                                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                                Procesando...
                            </>
                        ) : (
                            <>
                                <FileX className="w-4 h-4" />
                                Ejecutar Devolución
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default SaleReturnModal;
