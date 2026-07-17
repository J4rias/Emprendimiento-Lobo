import { useState, useEffect, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Modal, Input, Select, Textarea, Button } from '../ui';
import { formatMoney } from '../../utils/formatUtils';
import { AllocationSection, fmtNum, parseNum } from './AllocationSection';
import type { Allocation } from './AllocationSection';
import { supplierPaymentService } from '../../services/api/supplierPaymentService';
import { exchangeRateService } from '../../services/api/exchangeRateService';
import { calculateEffectiveRate } from '../../utils/exchangeRateUtils';
import { localToday } from '../../utils/dateUtils';

interface Supplier {
  id: number;
  name: string;
  company_name: string;
}

interface PaymentFormData {
  supplier_id: string | number;
  invoice_number: string;
  payment_date: string;
  payment_method: string;
  amount: string;
  currency: string;
  exchange_rate: string;
  exchange_rate_from: string;
  exchange_rate_to: string;
  reference: string;
  notes: string;
  purchase_order_id?: number;
}

interface CreditBalanceEntry {
  available_credit: number;
}

interface PaymentFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (payload: Record<string, unknown>) => void;
  suppliers: Supplier[];
  isPending: boolean;
}

const DEFAULT_FORM: PaymentFormData = {
  supplier_id: '',
  invoice_number: '',
  payment_date: localToday(),
  payment_method: 'transfer',
  amount: '',
  currency: 'USD',
  exchange_rate: '',
  exchange_rate_from: '',
  exchange_rate_to: '',
  reference: '',
  notes: '',
};

const METHOD_OPTIONS = [
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'check', label: 'Cheque' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'other', label: 'Otro' },
];

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD (Dólares)' },
  { value: 'COP', label: 'COP (Pesos)' },
  { value: 'VES', label: 'VES (Bolívares)' },
];

/**
 * Modal de creación de pago a proveedor.
 * Gestiona internamente todo el estado del formulario, asignaciones y tasa de cambio.
 * Admite prefill desde location.state.prefillOrder (navegar desde PO page).
 */
export function PaymentFormModal({ open, onClose, onSuccess, suppliers, isPending }: PaymentFormModalProps): React.ReactElement {
  const location = useLocation();

  // ─── Form state ──────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState<PaymentFormData>(DEFAULT_FORM);
  const [displayAmount, setDisplayAmount] = useState<string>('');
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [prefillLocked, setPrefillLocked] = useState<boolean>(false);

  // Rate state
  const [rateType, setRateType] = useState<string>('system');
  const [rateFlipped, setRateFlipped] = useState<boolean>(false);
  const [systemRate, setSystemRate] = useState<number | null>(null);
  const [loadingRate, setLoadingRate] = useState<boolean>(false);
  const [userEditedAmount, setUserEditedAmount] = useState<boolean>(false);

  // Available POs and credit balances for the selected supplier
  const [purchaseOrders, setPurchaseOrders] = useState<Array<{ id: number; order_number: string; total: string | number; balance?: string | number; currency: string; last_invoice_number?: string }>>([]);
  const [creditBalances, setCreditBalances] = useState<Record<string, CreditBalanceEntry> | null>(null);

  // ─── Reset ────────────────────────────────────────────────────────────────────
  const resetForm = (): void => {
    setFormData(DEFAULT_FORM);
    setDisplayAmount('');
    setAllocations([]);
    setPrefillLocked(false);
    setRateType('system');
    setRateFlipped(false);
    setSystemRate(null);
    setLoadingRate(false);
    setUserEditedAmount(false);
    setPurchaseOrders([]);
    setCreditBalances(null);
  };

  // Reset when modal closes
  useEffect(() => {
    if (!open) resetForm();
  }, [open]);

  // ─── Prefill desde location.state ────────────────────────────────────────────
  useEffect(() => {
    if (!open || !location.state?.prefillOrder) return;
    const order = location.state.prefillOrder;

    setFormData({
      supplier_id: order.supplier_id,
      purchase_order_id: order.id,
      invoice_number: order.last_invoice_number || '',
      payment_date: localToday(),
      payment_method: 'transfer',
      amount: order.total,
      currency: 'USD',
      exchange_rate: '',
      exchange_rate_from: '',
      exchange_rate_to: '',
      reference: `Pago ${order.order_number.startsWith('OC') ? order.order_number : 'OC ' + order.order_number}`,
      notes: '',
    });

    supplierPaymentService
      .getPayableBalance(order.supplier_id)
      .then((res) => {
        const poData = res.data?.purchase_orders?.find((p: { id: number; balance?: string | number }) => p.id === order.id);
        const trueBalance =
          poData && poData.balance !== undefined
            ? parseFloat(poData.balance)
            : parseFloat(order.total);
        const rawTotal = trueBalance.toFixed(2);

        setFormData((prev) => ({ ...prev, amount: rawTotal }));
        setDisplayAmount(fmtNum(rawTotal));
        setAllocations([
          {
            purchase_order_id: order.id,
            order_number: order.order_number,
            invoice_number: order.last_invoice_number || '',
            po_total: trueBalance,
            po_original_total: parseFloat(order.total),
            po_currency: order.currency,
            allocated_amount: rawTotal,
            display_amount: fmtNum(rawTotal),
          },
        ]);
      })
      .catch(() => {
        const rawTotal = parseFloat(order.total).toFixed(2);
        setDisplayAmount(fmtNum(rawTotal));
        setAllocations([
          {
            purchase_order_id: order.id,
            order_number: order.order_number,
            invoice_number: order.last_invoice_number || '',
            po_total: parseFloat(order.total),
            po_original_total: parseFloat(order.total),
            po_currency: order.currency,
            allocated_amount: rawTotal,
            display_amount: fmtNum(rawTotal),
          },
        ]);
      });

    setPrefillLocked(true);
  }, [open, location.state]);

  // ─── Auto-asignación cuando el usuario edita el monto (1 OC prefilled) ───────
  useEffect(() => {
    if (allocations.length !== 1 || !formData.amount || !userEditedAmount) return;
    const a = allocations[0];
    const rate = parseFloat(formData.exchange_rate);
    let maxInPayCur = a.po_total;

    if (
      a.po_currency !== formData.currency &&
      formData.exchange_rate &&
      rate > 0
    ) {
      if (formData.exchange_rate_from === a.po_currency && formData.exchange_rate_to === formData.currency)
        maxInPayCur = a.po_total * rate;
      else if (formData.exchange_rate_from === formData.currency && formData.exchange_rate_to === a.po_currency)
        maxInPayCur = a.po_total / rate;
      else if (formData.exchange_rate_from === 'USD' && formData.exchange_rate_to === 'VES')
        maxInPayCur = formData.currency === 'USD' ? a.po_total / rate : a.po_total * rate;
    }

    const suggested = Math.min(maxInPayCur, parseFloat(formData.amount)).toFixed(2);
    if (a.allocated_amount !== suggested && parseFloat(a.allocated_amount || '0') !== parseFloat(suggested)) {
      setAllocations([{
        ...a,
        allocated_amount: suggested,
        display_amount: parseFloat(suggested) > 0 ? fmtNum(suggested) : '',
      }]);
    }
  }, [formData.amount, userEditedAmount]);

  // ─── Carga de POs y saldo de crédito al seleccionar proveedor ─────────────────
  const fetchPurchaseOrdersBySupplier = async (supplierId: string | number): Promise<void> => {
    if (!supplierId) {
      setPurchaseOrders([]);
      setCreditBalances(null);
      return;
    }
    try {
      const [balanceRes, creditRes] = await Promise.all([
        supplierPaymentService.getPayableBalance(Number(supplierId)),
        supplierPaymentService.getCreditBalance(Number(supplierId)),
      ]);
      const receivable = (balanceRes.data?.purchase_orders || []).filter(
        (o: { balance: string | number }) => parseFloat(String(o.balance)) > 0
      );
      setPurchaseOrders(receivable);
      setCreditBalances(creditRes.data);
    } catch {
      setPurchaseOrders([]);
      setCreditBalances(null);
    }
  };

  const handleSupplierChange = (supplierId: string): void => {
    setFormData((prev) => ({ ...prev, supplier_id: supplierId, purchase_order_id: undefined }));
    setAllocations([]);
    fetchPurchaseOrdersBySupplier(supplierId);
  };

  // ─── Tasa del sistema (BFS triangulación) ────────────────────────────────────
  const fetchSystemRate = async (targetCurrency?: string): Promise<void> => {
    setLoadingRate(true);
    try {
      const res = await exchangeRateService.getLatest();
      const rates = res.data || [];
      const payCur = targetCurrency || formData.currency;
      const otherCur = allocations.find((a) => a.po_currency !== payCur)?.po_currency;
      if (!otherCur) return;

      const rate = calculateEffectiveRate(otherCur, payCur, rates);
      if (rate && rate > 0) {
        setSystemRate(rate);
        setRateType('system');
        setFormData((prev) => ({
          ...prev,
          exchange_rate: rate.toString(),
          exchange_rate_from: otherCur,
          exchange_rate_to: payCur,
        }));

        setTimeout(() => {
          setAllocations((prev) => {
            const updated = prev.map((a) => {
              if (a.po_currency === payCur)
                return { ...a, allocated_amount: a.po_total.toFixed(2), display_amount: fmtNum(a.po_total.toFixed(2)) };
              const converted = a.po_total * rate;
              return { ...a, allocated_amount: converted.toFixed(2), display_amount: fmtNum(converted.toFixed(2)) };
            });
            const total = updated.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
            if (total > 0) {
              const rawTotal = total.toFixed(2);
              setFormData((p) => ({ ...p, amount: rawTotal }));
              setDisplayAmount(fmtNum(rawTotal));
            }
            return updated;
          });
        }, 0);
      } else {
        setSystemRate(null);
        setRateType('custom');
      }
    } catch {
      setSystemRate(null);
      setRateType('custom');
    } finally {
      setLoadingRate(false);
    }
  };

  // ─── onRateApply: actualiza formData + recalcula asignaciones ─────────────────
  const handleRateApply = (rateStr: string, from: string, to: string): void => {
    setFormData((prev) => ({
      ...prev,
      exchange_rate: rateStr,
      exchange_rate_from: from,
      exchange_rate_to: to,
    }));
    if (!rateStr || parseFloat(rateStr) <= 0) return;
    const rate = parseFloat(rateStr);

    setAllocations((prev) => {
      const updated = prev.map((a) => {
        if (a.po_currency === formData.currency) return a;
        let converted;
        if (from === a.po_currency && to === formData.currency) converted = a.po_total * rate;
        else if (from === formData.currency && to === a.po_currency) converted = a.po_total / rate;
        else if (from === 'USD' && to === 'VES')
          converted = formData.currency === 'USD' ? a.po_total / rate : a.po_total * rate;
        else converted = a.po_total / rate;
        return { ...a, allocated_amount: converted.toFixed(2), display_amount: fmtNum(converted.toFixed(2)) };
      });
      const total = updated.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
      if (total > 0) {
        const rawTotal = total.toFixed(2);
        setFormData((p) => ({ ...p, amount: rawTotal }));
        setDisplayAmount(fmtNum(rawTotal));
      }
      return updated;
    });
  };

  // ─── Cambio de moneda ──────────────────────────────────────────────────────────
  const handleCurrencyChange = (newCurrency: string): void => {
    setRateFlipped(false);
    setSystemRate(null);
    setRateType('system');
    setFormData((prev) => ({
      ...prev,
      currency: newCurrency,
      exchange_rate: '',
      exchange_rate_from: '',
      exchange_rate_to: '',
    }));

    setAllocations((prev) => {
      const updated = prev.map((a) => {
        if (a.po_currency === newCurrency)
          return { ...a, allocated_amount: a.po_total.toFixed(2), display_amount: fmtNum(a.po_total.toFixed(2)) };
        return { ...a, allocated_amount: '', display_amount: '' };
      });
      const total = updated.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
      setFormData((p) => ({ ...p, amount: total > 0 ? total.toFixed(2) : '' }));
      setDisplayAmount(total > 0 ? fmtNum(total.toFixed(2)) : '');
      return updated;
    });

    const hasMismatch = allocations.some((a) => a.po_currency !== newCurrency);
    if (hasMismatch) fetchSystemRate(newCurrency);
  };

  // ─── Totales para validación del submit ───────────────────────────────────────
  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.allocated_amount) || 0), 0);
  const unallocated = (parseFloat(formData.amount) || 0) - totalAllocated;

  // Método de pago options — agrega "Saldo a Favor" solo si hay saldo disponible
  const methodOptions = [
    ...METHOD_OPTIONS,
    ...((creditBalances?.[formData.currency]?.available_credit ?? 0) > 0
      ? [{ value: 'credit_balance', label: 'Usar Saldo a Favor' }]
      : []),
  ];

  // ─── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    const payload = {
      ...formData,
      allocations:
        allocations.length > 0
          ? allocations.map((a) => ({
              purchase_order_id: a.purchase_order_id,
              invoice_number: a.invoice_number,
              allocated_amount: a.allocated_amount,
            }))
          : undefined,
    };
    onSuccess(payload);
  };

  const handleClose = (): void => {
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Registrar Nuevo Pago" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Proveedor */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor *</label>
            {prefillLocked ? (
              <div className="w-full h-9 px-3 flex items-center border border-gray-200 rounded-md bg-gray-50 text-gray-700 text-sm gap-2">
                <span className="text-gray-400">🔒</span>
                {suppliers.find((s) => s.id === parseInt(String(formData.supplier_id)))?.name || 'Proveedor'}
              </div>
            ) : (
              <Select
                value={formData.supplier_id}
                onChange={(e) => handleSupplierChange(e.target.value)}
                required
              >
                <option value="">Seleccione un proveedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {s.company_name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {/* Fecha */}
          <Input
            label="Fecha de pago *"
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData((p) => ({ ...p, payment_date: e.target.value }))}
            required
          />

          {/* Método de pago */}
          <Select
            label="Método de pago *"
            value={formData.payment_method}
            onChange={(e) => setFormData((p) => ({ ...p, payment_method: e.target.value }))}
            required
            options={methodOptions}
          />

          {/* Monto */}
          <div>
            <label className="flex justify-between items-end mb-1">
              <span className="text-xs font-medium text-gray-600">Monto Total del Pago *</span>
              {formData.payment_method === 'credit_balance' && creditBalances?.[formData.currency] && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  Máx: {formData.currency}{' '}
                  {formatMoney(creditBalances[formData.currency].available_credit, '', 2).trim()}
                </span>
              )}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={displayAmount}
              onFocus={() => setDisplayAmount(formData.amount)}
              onChange={(e) => {
                setDisplayAmount(e.target.value);
                setUserEditedAmount(true);
                const raw = parseNum(e.target.value);
                if (raw !== '' && !isNaN(parseFloat(raw)))
                  setFormData((p) => ({ ...p, amount: raw }));
              }}
              onBlur={() => {
                const raw = parseNum(displayAmount);
                const num = parseFloat(raw);
                if (!isNaN(num)) {
                  setFormData((p) => ({ ...p, amount: num.toFixed(2) }));
                  setDisplayAmount(fmtNum(num.toFixed(2)));
                } else {
                  setDisplayAmount('');
                }
              }}
              required
              placeholder="0,00"
              className="w-full h-9 px-3 text-sm rounded-md border border-gray-300 bg-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-500 transition-colors"
            />
          </div>

          {/* Moneda */}
          <Select
            label="Moneda del pago *"
            value={formData.currency}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            required
            options={CURRENCY_OPTIONS}
          />

          {/* Sección de asignación multi-OC */}
          <AllocationSection
            supplierId={formData.supplier_id}
            purchaseOrders={purchaseOrders}
            prefillLocked={prefillLocked}
            allocations={allocations}
            setAllocations={setAllocations}
            formCurrency={formData.currency}
            formAmount={formData.amount}
            exchangeRate={formData.exchange_rate}
            exchangeRateFrom={formData.exchange_rate_from}
            exchangeRateTo={formData.exchange_rate_to}
            rateType={rateType}
            setRateType={setRateType}
            rateFlipped={rateFlipped}
            setRateFlipped={setRateFlipped}
            systemRate={systemRate}
            loadingRate={loadingRate}
            onRateApply={handleRateApply}
          />

          {/* Referencia */}
          <Input
            label="Referencia de transacción"
            value={formData.reference}
            onChange={(e) => setFormData((p) => ({ ...p, reference: e.target.value }))}
            placeholder="Cheque, transferencia, etc."
          />

          {/* Notas */}
          <div className="md:col-span-2">
            <Textarea
              label="Notas"
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={isPending}
            disabled={
              allocations.length === 0 ||
              unallocated < -0.01 ||
              (formData.payment_method === 'credit_balance' &&
                parseFloat(formData.amount) > (creditBalances?.[formData.currency]?.available_credit || 0))
            }
          >
            Registrar Pago
          </Button>
        </div>
      </form>
    </Modal>
  );
}
