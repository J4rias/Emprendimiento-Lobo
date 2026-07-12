import { Sheet, Badge } from '../ui';

const STATUS_LABEL   = { recorded: 'Registrado', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_VARIANT = { recorded: 'warning',     confirmed: 'success',    cancelled: 'error' };
const METHOD_LABEL   = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque',
  card: 'Tarjeta',  other: 'Otro', credit_balance: 'Saldo a Favor', usdt: 'USDT',
};
const METHOD_VARIANT = {
  cash: 'success', transfer: 'info', check: 'purple',
  card: 'warning', other: 'neutral', credit_balance: 'purple', usdt: 'usdt',
};

const fmtDate     = (d) => (d ? new Date(d).toLocaleDateString('es-VE') : 'N/A');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('es-VE') : '');
const fmtAmt      = (v, currency) =>
  `${currency || ''} ${(parseFloat(v) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`.trim();

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm font-medium text-gray-900">{children}</div>
    </div>
  );
}

export function PaymentViewSheet({ payment, open, onClose }) {
  if (!payment) return null;

  const creatorName =
    [payment.creator?.first_name, payment.creator?.last_name].filter(Boolean).join(' ') ||
    payment.creator?.username ||
    'N/A';

  return (
    <Sheet open={open} onClose={onClose} title="Detalle del Pago" size="lg">
      <div className="space-y-5">

        {/* ── Resumen superior ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Número de pago</p>
            <p className="text-lg font-bold text-gray-900">{payment.payment_number}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Badge variant={STATUS_VARIANT[payment.status] ?? 'neutral'}>
              {STATUS_LABEL[payment.status] ?? payment.status}
            </Badge>
            {payment.payment_method && (
              <Badge variant={METHOD_VARIANT[payment.payment_method] ?? 'neutral'}>
                {METHOD_LABEL[payment.payment_method] ?? payment.payment_method}
              </Badge>
            )}
          </div>
        </div>

        {/* ── Monto ────────────────────────────────────────────────────────── */}
        <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">Monto total</p>
          <p className="text-2xl font-bold text-gray-900">
            {fmtAmt(payment.amount, payment.currency)}
          </p>
        </div>

        {/* ── Campos principales ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Fecha">{fmtDate(payment.payment_date)}</Field>
          <Field label="Proveedor">{payment.supplier?.name}</Field>
          {payment.invoice_number && (
            <Field label="N° Factura">{payment.invoice_number}</Field>
          )}
          {payment.reference && (
            <Field label="Referencia">{payment.reference}</Field>
          )}
          {payment.notes && (
            <div className="col-span-2">
              <Field label="Notas">{payment.notes}</Field>
            </div>
          )}
        </div>

        {/* ── Distribución del pago ────────────────────────────────────────── */}
        {payment.allocations?.length > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Distribución del pago
            </p>
            <div className="space-y-2">
              {payment.allocations.map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-start justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5"
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

        {/* ── Auditoría ────────────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">Registrado por</p>
          <p className="text-sm font-medium text-gray-900">{creatorName}</p>
          {payment.created_at && (
            <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(payment.created_at)}</p>
          )}
        </div>

      </div>
    </Sheet>
  );
}
