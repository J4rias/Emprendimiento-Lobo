import React from 'react';
import { Sheet, Badge } from '../ui';
import { formatMoney, formatDateShort, formatDate } from '../../utils/formatUtils';

const STATUS_LABEL   = { recorded: 'Registrado', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_VARIANT = { recorded: 'warning',     confirmed: 'success',    cancelled: 'error' } as const;
const METHOD_LABEL   = {
  cash: 'Efectivo', transfer: 'Transferencia', check: 'Cheque',
  card: 'Tarjeta',  other: 'Otro', credit_balance: 'Saldo a Favor', usdt: 'USDT',
};
const METHOD_VARIANT = {
  cash: 'success', transfer: 'info', check: 'purple',
  card: 'warning', other: 'neutral', credit_balance: 'purple', usdt: 'usdt',
} as const;

const fmtAmt = (v: number | string, currency?: string): string =>
  formatMoney(v, currency || '', 2);

// ── Field helper ──────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <div className="text-sm font-medium text-gray-900">{children}</div>
    </div>
  );
}

interface PaymentAllocation {
  id: number;
  purchase_order_id: number;
  allocated_amount: number | string;
  allocated_amount_po_currency?: number | string;
  exchange_rate_used?: number | string | null;
  invoice_number?: string | null;
  purchaseOrder?: { order_number?: string; currency?: string };
}

interface Payment {
  payment_number: string;
  payment_date?: string;
  status: string;
  payment_method?: string;
  amount: number | string;
  currency?: string;
  supplier?: { name: string };
  invoice_number?: string | null;
  reference?: string | null;
  notes?: string | null;
  allocations?: PaymentAllocation[];
  creator?: { first_name?: string; last_name?: string; username?: string };
  created_at?: string | null;
}

interface PaymentViewSheetProps {
  payment: Payment | null;
  open: boolean;
  onClose: () => void;
}

export function PaymentViewSheet({ payment, open, onClose }: PaymentViewSheetProps) {
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
            <Badge variant={STATUS_VARIANT[payment.status as keyof typeof STATUS_VARIANT] ?? 'neutral'}>
              {STATUS_LABEL[payment.status as keyof typeof STATUS_LABEL] ?? payment.status}
            </Badge>
            {payment.payment_method && (
              <Badge variant={METHOD_VARIANT[payment.payment_method as keyof typeof METHOD_VARIANT] ?? 'neutral'}>
                {METHOD_LABEL[payment.payment_method as keyof typeof METHOD_LABEL] ?? payment.payment_method}
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
          <Field label="Fecha">{formatDateShort(payment.payment_date)}</Field>
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
        {(payment.allocations?.length ?? 0) > 0 && (
          <div className="pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">
              Distribución del pago
            </p>
            <div className="space-y-2">
              {payment.allocations?.map((alloc) => (
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
                          ≈ {formatMoney(alloc.allocated_amount_po_currency ?? 0, alloc.purchaseOrder.currency, 2)}
                          {alloc.exchange_rate_used && alloc.exchange_rate_used !== 1 &&
                            ` (tasa: ${parseFloat(String(alloc.exchange_rate_used)).toFixed(4)})`}
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
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(payment.created_at)}</p>
          )}
        </div>

      </div>
    </Sheet>
  );
}
