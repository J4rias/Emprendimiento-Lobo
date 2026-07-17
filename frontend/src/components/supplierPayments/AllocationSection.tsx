import type { Dispatch, SetStateAction } from 'react';
import { X } from '@phosphor-icons/react';
import { Button } from '../ui';

export interface Allocation {
  purchase_order_id: number;
  order_number: string;
  invoice_number: string;
  po_total: number;
  po_original_total: number;
  po_currency: string;
  allocated_amount: string;
  display_amount?: string;
}

interface PurchaseOrder {
  id: number;
  order_number: string;
  total: string | number;
  balance?: string | number;
  currency: string;
  last_invoice_number?: string;
}

interface AllocationSectionProps {
  supplierId: string | number;
  purchaseOrders: PurchaseOrder[];
  prefillLocked: boolean;
  allocations: Allocation[];
  setAllocations: Dispatch<SetStateAction<Allocation[]>>;
  formCurrency: string;
  formAmount: string;
  exchangeRate: string;
  exchangeRateFrom: string;
  exchangeRateTo: string;
  rateType: string;
  setRateType: Dispatch<SetStateAction<string>>;
  rateFlipped: boolean;
  setRateFlipped: Dispatch<SetStateAction<boolean>>;
  systemRate: number | null;
  loadingRate: boolean;
  onRateApply: (rate: string, from: string, to: string) => void;
}

/** Formatea número con separadores de Venezuela (18.949.998,00) */
export const fmtNum = (val: string | number | null | undefined): string => {
  if (val === '' || val === null || val === undefined) return '';
  const n = parseFloat(String(val).replace(/,/g, '.'));
  if (isNaN(n)) return String(val);
  return n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Parsea formato es-VE de vuelta a string numérico */
export const parseNum = (val: string | number | null | undefined): string => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.includes(',')) return str.replace(/\./g, '').replace(',', '.');
  return str.replace(/[^0-9.]/g, '');
};

/**
 * Sección de distribución de pago entre órdenes de compra.
 * Incluye: selector de OCs, tasa de cambio cross-currency, filas de asignación, resumen.
 *
 * El padre (PaymentFormModal) posee todo el estado — esta sección solo lo muestra y modifica.
 */
export function AllocationSection({
  supplierId,
  purchaseOrders,
  prefillLocked,
  allocations,
  setAllocations,
  formCurrency,
  formAmount,
  exchangeRate,
  exchangeRateFrom,
  exchangeRateTo,
  rateType,
  setRateType,
  rateFlipped,
  setRateFlipped,
  systemRate,
  loadingRate,
  onRateApply,
}: AllocationSectionProps): React.ReactElement | null {
  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (parseFloat(a.allocated_amount) || 0),
    0
  );
  const unallocated = (parseFloat(formAmount) || 0) - totalAllocated;

  // ─── Handlers de alocación ────────────────────────────────────────────────────

  const addAllocation = (po: PurchaseOrder): void => {
    if (allocations.find((a) => a.purchase_order_id === po.id)) return;
    const poTotal = po.balance !== undefined ? parseFloat(po.balance) : parseFloat(po.total);
    const poOriginalTotal = parseFloat(po.total);
    const poCurrency = po.currency;

    const currentlyAllocated = allocations.reduce(
      (sum, a) => sum + (parseFloat(a.allocated_amount) || 0),
      0
    );
    const totalPayment = parseFloat(formAmount) || 0;
    const remaining = Math.max(0, totalPayment - currentlyAllocated);

    let maxInPayCur = poTotal;
    if (poCurrency !== formCurrency && exchangeRate && parseFloat(exchangeRate) > 0) {
      const rate = parseFloat(exchangeRate);
      if (exchangeRateFrom === poCurrency && exchangeRateTo === formCurrency)
        maxInPayCur = poTotal * rate;
      else if (exchangeRateFrom === formCurrency && exchangeRateTo === poCurrency)
        maxInPayCur = poTotal / rate;
      else if (exchangeRateFrom === 'USD' && exchangeRateTo === 'VES')
        maxInPayCur = formCurrency === 'USD' ? poTotal / rate : poTotal * rate;
    }

    const suggested =
      totalPayment > 0
        ? Math.min(maxInPayCur, remaining).toFixed(2)
        : maxInPayCur.toFixed(2);

    setAllocations((prev) => [
      ...prev,
      {
        purchase_order_id: po.id,
        order_number: po.order_number,
        invoice_number: po.last_invoice_number || '',
        po_total: poTotal,
        po_original_total: poOriginalTotal,
        po_currency: poCurrency,
        allocated_amount: suggested,
        display_amount: parseFloat(suggested) > 0 ? fmtNum(suggested) : '',
      },
    ]);
  };

  const removeAllocation = (poId: number): void =>
    setAllocations((prev) => prev.filter((a) => a.purchase_order_id !== poId));

  const updateInvoice = (poId: number, invoice: string): void =>
    setAllocations((prev) =>
      prev.map((a) => (a.purchase_order_id === poId ? { ...a, invoice_number: invoice } : a))
    );

  // ─── Exchange rate UI helpers ──────────────────────────────────────────────────

  const hasCrossCurrency = allocations.some((a) => a.po_currency !== formCurrency);
  const otherCur = allocations.find((a) => a.po_currency !== formCurrency)?.po_currency;

  const fromCur = rateFlipped ? formCurrency : otherCur;
  const toCur = rateFlipped ? otherCur : formCurrency;
  const systemRateForDir = systemRate ? (rateFlipped ? 1 / systemRate : systemRate) : null;

  const flipRate = (): void => {
    const newFlipped = !rateFlipped;
    setRateFlipped(newFlipped);
    const newFrom = newFlipped ? formCurrency : otherCur;
    const newTo = newFlipped ? otherCur : formCurrency;
    if (rateType === 'system' && systemRate) {
      const newRate = newFlipped ? 1 / systemRate : systemRate;
      onRateApply(newRate.toString(), newFrom, newTo);
    } else {
      const cur = parseFloat(exchangeRate);
      onRateApply(cur > 0 ? (1 / cur).toString() : '', newFrom, newTo);
    }
  };

  if (!supplierId) return null;

  return (
    <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
        <div className="w-1 h-5 bg-primary-500 rounded-full" />
        Distribuir Pago entre Facturas
      </h4>

      {/* ── Selector de OC ────────────────────────────────────────────────── */}
      {purchaseOrders.length > 0 && !prefillLocked && (
        <div className="mb-3">
          <select
            onChange={(e) => {
              const po = purchaseOrders.find((p) => p.id === parseInt(e.target.value));
              if (po) addAllocation(po);
              e.target.value = '';
            }}
            defaultValue=""
            className="w-full px-3 py-2 border border-dashed border-primary-300 rounded-lg bg-primary-50 text-primary-700 text-sm focus:ring-2 focus:ring-primary-200 focus:border-primary-500 focus:outline-none"
          >
            <option value="" disabled>
              + Seleccionar Orden de Compra para abonar...
            </option>
            {purchaseOrders
              .filter((po) => !allocations.find((a) => a.purchase_order_id === po.id))
              .map((po) => (
                <option key={po.id} value={po.id}>
                  {po.order_number} — Total: {po.currency}{' '}
                  {parseFloat(po.total).toLocaleString('es-VE', { minimumFractionDigits: 2 })} |
                  Saldo: {po.currency}{' '}
                  {parseFloat(po.balance ?? po.total).toLocaleString('es-VE', {
                    minimumFractionDigits: 2,
                  })}
                  {po.last_invoice_number ? ` (Fact: ${po.last_invoice_number})` : ''}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* ── Tasa de cambio cross-currency ─────────────────────────────────── */}
      {hasCrossCurrency && (
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 mb-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-bold text-amber-700">
              💱 Tasa de Cambio ({fromCur} → {toCur})
            </label>
            <button
              type="button"
              onClick={flipRate}
              title={`Cambiar a ${rateFlipped ? `${otherCur} → ${formCurrency}` : `${formCurrency} → ${otherCur}`}`}
              className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-300 transition-colors font-bold"
            >
              ⇄
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              disabled={!systemRate && !loadingRate}
              onClick={() => {
                if (!systemRate) return;
                setRateType('system');
                onRateApply(systemRateForDir.toString(), fromCur, toCur);
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                loadingRate
                  ? 'bg-amber-100 text-amber-500 border border-amber-200 cursor-wait'
                  : !systemRate
                  ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                  : rateType === 'system'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-100'
              }`}
            >
              {loadingRate
                ? '⏳ Cargando tasa...'
                : systemRateForDir
                ? `📊 Tasa del Sistema (${systemRateForDir.toFixed(4)})`
                : '📊 Tasa del Sistema (no disponible)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRateType('custom');
                onRateApply('', fromCur, toCur);
              }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                rateType === 'custom' || !systemRate
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-100'
              }`}
            >
              ✏️ Tasa Pactada
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 whitespace-nowrap">1 {fromCur} =</span>
            {rateType === 'system' && systemRate ? (
              <div className="flex-1 px-3 py-2 bg-white border border-amber-200 rounded-lg font-bold text-amber-700 text-center">
                {loadingRate ? 'Cargando...' : systemRateForDir.toFixed(4)}
              </div>
            ) : (
              <input
                type="number"
                step="0.000001"
                min="0"
                value={exchangeRate}
                onChange={(e) => onRateApply(e.target.value, fromCur, toCur)}
                placeholder="Ingrese la tasa"
                className="flex-1 px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-200 focus:border-amber-400 focus:outline-none font-bold text-amber-700 text-center"
              />
            )}
            <span className="text-sm text-gray-600">{toCur}</span>
          </div>

          {exchangeRate && parseFloat(formAmount) > 0 && (
            <p className="mt-2 text-sm text-amber-600">
              Equivalente:{' '}
              <strong>
                {(() => {
                  const rate = parseFloat(exchangeRate);
                  const amount = parseFloat(formAmount);
                  if (exchangeRateFrom === otherCur)
                    return `${otherCur} ${(amount / rate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
                  return `${otherCur} ${(amount * rate).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`;
                })()}
              </strong>
            </p>
          )}
        </div>
      )}

      {/* ── Filas de asignación ───────────────────────────────────────────── */}
      {allocations.length > 0 && (
        <div className="space-y-2 mb-3">
          {allocations.map((alloc) => {
            const crossCurrency = alloc.po_currency !== formCurrency;
            let equivalentInPO = null;
            if (crossCurrency && exchangeRate && parseFloat(alloc.allocated_amount) > 0) {
              const rate = parseFloat(exchangeRate);
              const allocAmt = parseFloat(alloc.allocated_amount);
              if (exchangeRateFrom === alloc.po_currency) equivalentInPO = allocAmt / rate;
              else if (exchangeRateTo === alloc.po_currency) equivalentInPO = allocAmt * rate;
              else equivalentInPO = allocAmt / rate;
            }

            return (
              <div key={alloc.purchase_order_id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-800">{alloc.order_number}</div>
                    <div className="text-xs text-gray-500">
                      Saldo: {alloc.po_currency}{' '}
                      {alloc.po_total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      {alloc.po_original_total && alloc.po_total !== alloc.po_original_total
                        ? ` (de ${alloc.po_original_total.toLocaleString('es-VE', { minimumFractionDigits: 2 })})`
                        : ''}
                      {crossCurrency && (
                        <span className="ml-1 text-amber-500">
                          ({alloc.po_currency} ≠ {formCurrency})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Factura */}
                  {prefillLocked && alloc.invoice_number ? (
                    <div className="w-28 px-2 py-1.5 border border-gray-200 rounded bg-gray-50 text-xs text-gray-600 flex items-center gap-1">
                      <span className="text-gray-400">🔒</span>
                      {alloc.invoice_number}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={alloc.invoice_number}
                      onChange={(e) => updateInvoice(alloc.purchase_order_id, e.target.value)}
                      placeholder="# Factura"
                      className="w-28 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-primary-200 focus:border-primary-500 focus:outline-none"
                    />
                  )}

                  {/* Monto asignado */}
                  <input
                    type="text"
                    inputMode="decimal"
                    value={alloc.display_amount ?? fmtNum(alloc.allocated_amount)}
                    onFocus={() =>
                      setAllocations((prev) =>
                        prev.map((a) =>
                          a.purchase_order_id === alloc.purchase_order_id
                            ? { ...a, display_amount: a.allocated_amount }
                            : a
                        )
                      )
                    }
                    onChange={(e) => {
                      const raw = parseNum(e.target.value);
                      setAllocations((prev) =>
                        prev.map((a) =>
                          a.purchase_order_id === alloc.purchase_order_id
                            ? { ...a, display_amount: e.target.value, allocated_amount: raw }
                            : a
                        )
                      );
                    }}
                    onBlur={() => {
                      setAllocations((prev) =>
                        prev.map((a) => {
                          if (a.purchase_order_id !== alloc.purchase_order_id) return a;
                          const num = parseFloat(a.allocated_amount);
                          return {
                            ...a,
                            display_amount: !isNaN(num) ? fmtNum(num.toFixed(2)) : '',
                            allocated_amount: !isNaN(num) ? num.toFixed(2) : '',
                          };
                        })
                      );
                    }}
                    placeholder="0,00"
                    className="w-36 px-2 py-1.5 border border-gray-300 rounded text-sm font-bold text-right focus:ring-2 focus:ring-primary-200 focus:border-primary-500 focus:outline-none"
                  />
                  <span className="text-xs text-gray-500 w-8">{formCurrency}</span>

                  {!prefillLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAllocation(alloc.purchase_order_id)}
                    >
                      <X className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </Button>
                  )}
                </div>

                {crossCurrency && equivalentInPO !== null && (
                  <div className="mt-1 text-xs text-amber-600 pl-1">
                    ≈ {alloc.po_currency}{' '}
                    {equivalentInPO.toLocaleString('es-VE', { minimumFractionDigits: 2 })} de{' '}
                    {alloc.po_currency}{' '}
                    {alloc.po_total.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Resumen de asignación ─────────────────────────────────────────── */}
      {allocations.length > 0 && formAmount && (
        <div className="bg-primary-50 p-3 rounded-lg border border-primary-100 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total del pago:</span>
            <span className="font-bold">
              {formCurrency}{' '}
              {parseFloat(formAmount).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Distribuido:</span>
            <span className="font-bold text-green-600">
              {formCurrency} {totalAllocated.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {unallocated < -0.01 && (
            <div className="mt-1 pt-1 border-t border-red-300">
              <div className="flex justify-between">
                <span className="text-red-700 font-medium">⚠️ Error de distribución:</span>
                <span className="font-bold text-red-700">
                  {formCurrency}{' '}
                  {Math.abs(unallocated).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-red-600 mt-1">
                El monto distribuido supera el Total del Pago. Reduce lo asignado o aumenta el Total.
              </p>
            </div>
          )}

          {unallocated > 0.01 && (
            <div className="mt-1 pt-1 border-t border-primary-300">
              <div className="flex justify-between">
                <span className="text-primary-700 font-medium">✨ Saldo a Favor generado:</span>
                <span className="font-bold text-primary-700">
                  {formCurrency}{' '}
                  {unallocated.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="text-xs text-primary-600 mt-1">
                La diferencia quedará como anticipo o saldo a favor del proveedor.
              </p>
            </div>
          )}
        </div>
      )}

      {purchaseOrders.length === 0 && supplierId && !prefillLocked && (
        <p className="text-sm text-gray-400 italic">
          Este proveedor no tiene órdenes recibidas pendientes de pago.
        </p>
      )}
    </div>
  );
}
