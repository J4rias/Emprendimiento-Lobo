import { useState, useEffect } from 'react';
import { Modal, Input, Select, Textarea, Button } from '../ui';

const METHOD_OPTIONS = [
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'check', label: 'Cheque' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
];

const DEFAULT_FORM = {
  payment_date: '',
  payment_method: 'transfer',
  reference: '',
  invoice_number: '',
  notes: '',
};

export function PaymentEditModal({ payment, open, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (payment && open) {
      setForm({
        payment_date: payment.payment_date ?? '',
        payment_method: payment.payment_method ?? 'transfer',
        reference: payment.reference ?? '',
        invoice_number: payment.invoice_number ?? '',
        notes: payment.notes ?? '',
      });
    }
  }, [payment?.id, open]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const fmtAmt = (v, currency) =>
    `${currency || ''} ${(parseFloat(v) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`.trim();

  return (
    <Modal open={open} onClose={onClose} title="Editar Pago" size="lg">
      {/* Monto read-only */}
      {payment && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-4 mb-5">
          <div>
            <p className="text-xs text-gray-500">Monto</p>
            <p className="font-bold text-lg text-gray-800">{fmtAmt(payment.amount, payment.currency)}</p>
          </div>
          <div className="w-px h-10 bg-gray-200" />
          <div>
            <p className="text-xs text-gray-500">Número de pago</p>
            <p className="font-medium text-gray-700">{payment.payment_number}</p>
          </div>
          <span className="ml-auto text-xs text-gray-400 italic">Monto y moneda no editables</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Fecha de pago *"
            type="date"
            value={form.payment_date}
            onChange={set('payment_date')}
            required
          />
          <Select
            label="Método de pago *"
            value={form.payment_method}
            onChange={set('payment_method')}
            required
            options={METHOD_OPTIONS}
          />
          <Input
            label="Referencia"
            value={form.reference}
            onChange={set('reference')}
            placeholder="Número de cheque, referencia de transferencia..."
          />
          <Input
            label="N° Factura del proveedor"
            value={form.invoice_number}
            onChange={set('invoice_number')}
            placeholder="Ej: FAC-001"
          />
          <div className="md:col-span-2">
            <Textarea
              label="Notas"
              value={form.notes}
              onChange={set('notes')}
              rows={2}
            />
          </div>
        </div>

        {/* Distribución read-only */}
        {payment?.allocations?.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Distribución del pago</p>
            <div className="space-y-2">
              {payment.allocations.map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium text-primary-600">
                      {alloc.purchaseOrder?.order_number || `OC #${alloc.purchase_order_id}`}
                    </span>
                    {alloc.invoice_number && (
                      <span className="ml-2 text-gray-500">Fact: {alloc.invoice_number}</span>
                    )}
                  </div>
                  <span className="font-semibold text-gray-800">
                    {payment.currency}{' '}
                    {parseFloat(alloc.allocated_amount).toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Actualizar Pago
          </Button>
        </div>
      </form>
    </Modal>
  );
}
