import { useState, useEffect } from 'react';
import { ShoppingBag, RefreshCcw, FileX } from 'lucide-react';
import { creditNoteService } from '../../services/api/creditNoteService';
import Modal from '../common/Modal';
import toast from 'react-hot-toast';

const SaleReturnModal = ({ isOpen, onClose, sale, onReturnSuccess }) => {
    const [returnItems, setReturnItems] = useState([]);
    const [reason, setReason] = useState('return');
    const [reasonDescription, setReasonDescription] = useState('');
    const [refundMethod, setRefundMethod] = useState('credit_balance');
    const [submitting, setSubmitting] = useState(false);
    const [serverError, setServerError] = useState(null);

    // Initialize return items — subtract already returned quantities
    useEffect(() => {
        if (!isOpen || !sale || !sale.details) return;

        const initItems = async () => {
            // Build map of already returned units per sale_detail_id
            const returnedMap = {};
            try {
                const cn = await creditNoteService.getAll({ sale_id: sale.id, status: 'applied', limit: 100 });
                for (const note of cn.data || []) {
                    for (const d of note.details || []) {
                        const uph = d.presentation?.units_per_package || 1;
                        // package_quantity_returned is in presentation units; loose_units_returned is in base units
                        const units = d.package_quantity_returned + ((d.loose_units_returned || 0) / uph);
                        returnedMap[d.sale_detail_id] = (returnedMap[d.sale_detail_id] || 0) + units;
                    }
                }
            } catch (_) { /* ignore, fallback to original qty */ }

            const items = sale.details.map(detail => {
                const originalQty = parseFloat(detail.quantity);
                const alreadyReturned = returnedMap[detail.id] || 0;
                const available = Math.max(0, originalQty - alreadyReturned);
                return {
                    ...detail,
                    returnQuantity: 0,
                    maxQuantity: available,
                    originalQuantity: originalQty,
                    alreadyReturned
                };
            });
            setReturnItems(items);
            setReason('return');
            setReasonDescription('');
            setRefundMethod(sale.customer_id ? 'credit_balance' : 'cash');
        };

        initItems();
    }, [isOpen, sale]);

    const handleQuantityChange = (id, value) => {
        const qty = parseFloat(value) || 0;
        setReturnItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, returnQuantity: Math.min(Math.max(0, qty), item.maxQuantity) };
            }
            return item;
        }));
    };

    const handleSetMax = (id) => {
        setReturnItems(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, returnQuantity: item.maxQuantity };
            }
            return item;
        }));
    };

    // Calculate totals for the preview
    const calculateTotals = () => {
        let subtotal = 0;
        returnItems.forEach(item => {
            if (item.returnQuantity > 0) {
                const unitPrice = parseFloat(item.unit_price);
                subtotal += unitPrice * item.returnQuantity;
            }
        });

        // We can proportionally discount if needed, but for simplicity we'll just return raw subtotal
        // In a production system, one might calculate tax and discounts proportionally to the returned items.

        // Check if it's a full return
        const isFullReturn = returnItems.every(item => item.returnQuantity === item.maxQuantity);

        const finalTotal = isFullReturn ? (parseFloat(sale?.total || 0)) : subtotal;

        return {
            subtotal,
            total: finalTotal,
            isFullReturn
        };
    };

    const totals = calculateTotals();
    const COP_RATE = sale?.exchange_rate || 1; // Simplification, normally fetched from effective rate

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(val * COP_RATE));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);

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
                sale_id: sale.id,
                reason,
                reason_description: reasonDescription,
                type: totals.isFullReturn ? 'full' : 'partial',
                refund_method: isConsumidorFinal ? (refundMethod === 'credit_balance' ? 'none' : refundMethod) : refundMethod,
                items: itemsToReturn.map(item => {
                    const unitsPerPackage = item.presentation?.units_per_package || 1;
                    return {
                        sale_detail_id: item.id,
                        package_quantity_returned: Math.floor(item.returnQuantity / unitsPerPackage),
                        loose_units_returned: item.returnQuantity % unitsPerPackage,
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
            const serverMsg = error.response?.data?.error || error.response?.data?.message || error.message;
            setServerError(serverMsg);
            toast.error(`Error: ${serverMsg}`, { duration: 8000 });
        } finally {
            setSubmitting(false);
        }
    };

    if (!sale) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => !submitting && onClose()}
            title={
                <div className="flex items-center gap-2 text-rose-600">
                    <RefreshCcw className="w-5 h-5" />
                    <span>Generar Devolución - Venta {sale.sale_number}</span>
                </div>
            }
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Info Header */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Cliente</p>
                        <p className="text-sm font-medium text-gray-900">
                            {sale.customer
                                ? (sale.customer.businessName || `${sale.customer.firstName || ''} ${sale.customer.lastName || ''}`.trim() || 'Consumidor Final')
                                : 'Consumidor Final'}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase">Total Venta</p>
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(parseFloat(sale.total))}</p>
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
                                    <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase bg-blue-50/50">CANT. A DEVOLVER</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal (COP)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {returnItems.map(item => (
                                    <tr key={item.id} className={item.returnQuantity > 0 ? 'bg-rose-50/30' : ''}>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium text-gray-900">{item.product?.name}</div>
                                            <div className="text-xs text-gray-500">{item.presentation?.name || 'Unidad'} - {formatCurrency(parseFloat(item.unit_price))} / c.u.</div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-sm text-gray-600 font-medium">
                                            {item.originalQuantity ?? item.maxQuantity}
                                            {item.alreadyReturned > 0 && (
                                                <div className="text-xs text-orange-500">({item.alreadyReturned} devueltos)</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 bg-blue-50/20 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={item.maxQuantity}
                                                    step="1"
                                                    value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                                                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                                    placeholder="0"
                                                    className="w-20 px-2 py-1 text-center border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 bg-white"
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
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-medium text-rose-600">
                                            {item.returnQuantity > 0
                                                ? formatCurrency(item.returnQuantity * parseFloat(item.unit_price))
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
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
                                rows="2"
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
                                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-medium text-blue-900 bg-blue-50"
                            >
                                <option value="credit_balance" disabled={!sale?.customer_id}>💰 Monedero (Saldo a Favor del Cliente){!sale?.customer_id ? ' — N/A Consumidor Final' : ''}</option>
                                <option value="cash">💵 Entregar Efectivo Físico</option>
                                <option value="transfer">🏦 Pago Móvil / Transferencia</option>
                                <option value="none">❌ Nada (Solo cuadre de inventario/error)</option>
                            </select>
                        </div>

                        <div className="pt-4 border-t border-gray-200">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span className="text-gray-800">Monto Acreditar:</span>
                                <span className="text-rose-600">{formatCurrency(totals.total)}</span>
                            </div>
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
