import React from 'react';
import { Sheet, Badge, Button } from '../ui';

const STATUS_VARIANT: Record<string, string> = { draft:'neutral', sent:'info', confirmed:'warning', partial:'info', received:'success', cancelled:'error' };
const STATUS_LABEL: Record<string, string>   = { draft:'Borrador', sent:'Enviada', confirmed:'Confirmada', partial:'Parcial', received:'Recibida', cancelled:'Cancelada' };
const PAYMENT_VARIANT: Record<string, string> = { pending:'warning', partial:'info', paid:'success', overdue:'error' };
const PAYMENT_LABEL: Record<string, string>   = { pending:'Pago Pendiente', partial:'Pago Parcial', paid:'Pagado', overdue:'Vencido' };
const PAYMENT_METHOD_LABEL: Record<string, string> = { cash:'Efectivo', transfer:'Transferencia', check:'Cheque', credit:'Crédito', other:'Otro' };
const PAYMENT_METHOD_COLOR: Record<string, string> = {
  cash:     'bg-emerald-100 text-emerald-800',
  transfer: 'bg-primary-100    text-primary-800',
  check:    'bg-purple-100  text-purple-800',
  credit:   'bg-amber-100   text-amber-800',
  other:    'bg-gray-100    text-gray-800',
};

const formatMoney = (amount: string | number, currency = 'USD'): string => {
  const val = parseFloat(amount || 0);
  return `${currency} ${val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

interface PurchaseOrderViewSheetProps {
  open: boolean;
  onClose: () => void;
  order: Record<string, unknown> | null;
}

const PurchaseOrderViewSheet: React.FC<PurchaseOrderViewSheetProps> = ({ open, onClose, order }) => {
  if (!order) return null;

  return (
    <Sheet open={open} onClose={onClose} title={`Orden de Compra: ${order.order_number}`} size="xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{order.supplier?.name}</h2>
          <p className="text-xs text-gray-500">{order.warehouse?.name} · {new Date(order.order_date).toLocaleDateString('es-VE')}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge variant={STATUS_VARIANT[order.status] || 'neutral'}>
            {STATUS_LABEL[order.status] || order.status}
          </Badge>
          {order.payment_status && PAYMENT_LABEL[order.payment_status] && (
            <Badge variant={PAYMENT_VARIANT[order.payment_status] || 'neutral'}>
              {PAYMENT_LABEL[order.payment_status]}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Facturas */}
        {order.invoices?.length > 0 && (
          <section className="bg-primary-50 rounded-lg p-4 border border-primary-100">
            <p className="text-xs font-bold text-primary-600 uppercase tracking-wider mb-2">Documentos / Facturas</p>
            <div className="flex flex-wrap gap-2">
              {order.invoices.map((inv, i) => (
                <span key={i} className="px-3 py-1 bg-white text-primary-700 font-bold rounded-full border border-primary-200 text-sm">
                  #{inv}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Productos */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Productos</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  {['Producto', 'Presentación', 'Ordenado', 'Recibido', 'Costo Unit.', 'Total'].map((h) => (
                    <th key={h} className={`px-3 py-2 text-xs font-medium text-gray-500 uppercase ${['Ordenado','Recibido','Costo Unit.','Total'].includes(h) ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {order.details?.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900">{d.product?.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{d.presentation?.name}</td>
                    <td className="px-3 py-2 text-sm text-right">{d.package_quantity}p + {d.loose_units}u</td>
                    <td className="px-3 py-2 text-sm text-gray-600 text-right">{d.received_package_quantity}p + {d.received_loose_units}u</td>
                    <td className="px-3 py-2 text-sm text-right">{formatMoney(d.unit_cost, order.currency)}</td>
                    <td className="px-3 py-2 text-sm font-medium text-right">{formatMoney(d.line_total, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Totales */}
        <section className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-2 text-sm">
          {[
            { label: 'Subtotal',   value: formatMoney(order.subtotal, order.currency) },
            { label: 'Descuento',  value: `-${formatMoney(order.discount_amount, order.currency)}`, cls: 'text-red-600' },
            { label: 'Impuestos',  value: formatMoney(order.tax_amount, order.currency) },
          ].map(({ label, value, cls }) => (
            <div key={label} className="flex justify-between">
              <span className="text-gray-600">{label}:</span>
              <span className={`font-medium ${cls || ''}`}>{value}</span>
            </div>
          ))}
          <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
            <span>Total:</span>
            <span className="text-primary-600">{formatMoney(order.total, order.currency)}</span>
          </div>
        </section>

        {/* Historial de Recepciones */}
        {order.reception_history?.length > 0 && (
          <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-green-500 rounded-full" />
              Historial de Recepciones
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    {['Fecha', 'Documento', 'Cantidad (U)', 'Recibido por'].map((h, i) => (
                      <th key={h} className={`px-3 py-2 text-xs font-bold text-gray-500 uppercase ${i === 2 ? 'text-center' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {order.reception_history.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {new Date(rec.date).toLocaleDateString('es-VE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-primary-600">{rec.document_number || order.order_number}</td>
                      <td className="px-3 py-2 text-sm text-center font-bold text-green-600">+{parseFloat(rec.quantity).toLocaleString('es-VE')}</td>
                      <td className="px-3 py-2 text-sm text-gray-600 italic">{rec.user}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Historial de Pagos */}
        {order.payment_history?.length > 0 && (
          <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-primary-500 rounded-full" />
              Historial de Pagos
            </h4>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-white">
                  <tr>
                    {['Fecha', 'Referencia', 'Método', 'Monto (OC)'].map((h, i) => (
                      <th key={h} className={`px-3 py-2 text-xs font-bold text-gray-500 uppercase ${i === 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {order.payment_history.map((pay, i) => (
                    <tr key={pay.id || i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                        {new Date(pay.payment_date).toLocaleDateString('es-VE')}
                      </td>
                      <td className="px-3 py-2 text-sm font-bold text-primary-600">{pay.payment_number}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_METHOD_COLOR[pay.payment_method] || PAYMENT_METHOD_COLOR.other}`}>
                          {PAYMENT_METHOD_LABEL[pay.payment_method] || pay.payment_method}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-right font-bold text-gray-900">
                        {order.currency} {parseFloat(pay.allocated_amount_po_currency).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {order.notes && (
          <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
            <p className="text-xs font-bold text-amber-700 uppercase mb-1">Notas de la Orden</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        <div className="pt-2 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} className="w-full">Cerrar</Button>
        </div>
      </div>
    </Sheet>
  );
};

export default PurchaseOrderViewSheet;
