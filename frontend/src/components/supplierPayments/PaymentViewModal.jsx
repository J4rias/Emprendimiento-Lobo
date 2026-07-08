import { Modal, Badge } from '../ui';

const STATUS_LABEL = { recorded: 'Registrado', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_VARIANT = { recorded: 'warning', confirmed: 'success', cancelled: 'error' };
const METHOD_LABEL = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  check: 'Cheque',
  card: 'Tarjeta',
  other: 'Otro',
  credit_balance: 'Saldo a Favor',
  usdt: 'USDT',
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('es-VE') : 'N/A');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('es-VE') : '');
const fmtAmt = (v, currency) =>
  `${currency || ''} ${(parseFloat(v) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`.trim();

export function PaymentViewModal({ payment, open, onClose }) {
  if (!payment) return null;

  return (
    <Modal open={open} onClose={onClose} title="Detalle del Pago" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">Número de pago</p>
            <p className="font-semibold text-gray-900">{payment.payment_number}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Estado</p>
            <Badge variant={STATUS_VARIANT[payment.status] ?? 'neutral'}>
              {STATUS_LABEL[payment.status] ?? payment.status}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-gray-500">Fecha</p>
            <p className="font-medium text-gray-900">{fmtDate(payment.payment_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Proveedor</p>
            <p className="font-medium text-gray-900">{payment.supplier?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Método de pago</p>
            <p className="font-medium text-gray-900">
              {METHOD_LABEL[payment.payment_method] ?? payment.payment_method}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Monto total</p>
            <p className="text-lg font-bold text-gray-900">{fmtAmt(payment.amount, payment.currency)}</p>
          </div>
          {payment.invoice_number && (
            <div>
              <p className="text-xs text-gray-500">N° Factura</p>
              <p className="font-medium text-gray-900">{payment.invoice_number}</p>
            </div>
          )}
          {payment.reference && (
            <div>
              <p className="text-xs text-gray-500">Referencia</p>
              <p className="font-medium text-gray-900">{payment.reference}</p>
            </div>
          )}
          {payment.notes && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500">Notas</p>
              <p className="font-medium text-gray-900">{payment.notes}</p>
            </div>
          )}
          <div className="col-span-2">
            <p className="text-xs text-gray-500">Registrado por</p>
            <p className="font-medium text-gray-900">
              {[payment.creator?.first_name, payment.creator?.last_name].filter(Boolean).join(' ') ||
                payment.creator?.username ||
                'N/A'}
            </p>
            <p className="text-xs text-gray-400">{fmtDateTime(payment.created_at)}</p>
          </div>
        </div>

        {payment.allocations?.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">Distribución del pago</p>
            <div className="space-y-2">
              {payment.allocations.map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-start justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-primary-600">
                      {alloc.purchaseOrder?.order_number || `OC #${alloc.purchase_order_id}`}
                    </p>
                    {alloc.invoice_number && (
                      <p className="text-xs text-gray-500">Factura: {alloc.invoice_number}</p>
                    )}
                    {alloc.purchaseOrder?.currency &&
                      alloc.purchaseOrder.currency !== payment.currency && (
                        <p className="text-xs text-gray-400">
                          ≈ {alloc.purchaseOrder.currency}{' '}
                          {parseFloat(alloc.allocated_amount_po_currency).toLocaleString('es-VE', {
                            minimumFractionDigits: 2,
                          })}
                          {alloc.exchange_rate_used && alloc.exchange_rate_used !== 1 &&
                            ` (tasa: ${parseFloat(alloc.exchange_rate_used).toFixed(4)})`}
                        </p>
                      )}
                  </div>
                  <span className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                    {fmtAmt(alloc.allocated_amount, payment.currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
