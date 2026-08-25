import React from 'react';
import { useCheckoutPayments } from '../../hooks/useCheckoutPayments';
import { getCustomerDisplayName, roundToNearest100COP } from '../../utils/paymentUtils';
import type { PaymentLine, ExchangeRate, Customer } from '../../utils/paymentUtils';
import { CURRENCIES, PAYMENT_METHODS, METHODS_BY_CURRENCY, COP_TOLERANCE, saveRate } from '../../hooks/usePOS';
import { LOCALE } from '../../utils/formatUtils';
import CustomerSearch from '../CustomerSearch';
import ImageUpload from '../common/ImageUpload';
import { Modal, Button, Textarea } from '../ui';
import {
  User, X, Money, CreditCard, DeviceMobile, Hash, Camera,
} from '@phosphor-icons/react';
import { toast } from 'sonner';

// Icon map for payment methods
const PAYMENT_ICONS: Record<string, React.ComponentType<any>> = {
  cash: Money, card: CreditCard, transfer: DeviceMobile, usdt: Hash,
};

export interface CheckoutModalProps {
  show: boolean;
  onClose: () => void;
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  totalCOP: number;
  copPerUSD: number;
  paymentLines: PaymentLine[];
  setPaymentLines: (lines: PaymentLine[]) => void;
  customer: Customer | null;
  onCustomerSelect: ((c: Customer | null) => void) | null;
  saleType: string;
  notes: string;
  setNotes: ((v: string) => void) | null;
  exchangeRates: ExchangeRate[];
  displayCurrency: string;
  onComplete: () => void;
  saving: boolean;
  isAdmin: boolean;
  mode: 'create' | 'collect';
  allowCredit?: boolean;
  title?: string;
  confirmLabel?: string;
}

export default function CheckoutModal({
  show, onClose, subtotal, discount = 0, tax = 0, total, totalCOP, copPerUSD,
  paymentLines, setPaymentLines,
  customer, onCustomerSelect,
  saleType,
  notes, setNotes,
  exchangeRates, displayCurrency,
  onComplete, saving, isAdmin,
  mode,
  allowCredit = true,
  title,
  confirmLabel,
}: CheckoutModalProps) {
  const checkout = useCheckoutPayments({
    paymentLines, setPaymentLines,
    totalCOP, copPerUSD, displayCurrency, exchangeRates,
  });

  const {
    isUSD, sSym, fmtTotal, fmtCOP, fmtLine,
    newPayCurrency, newPayMethod, newPayAmount, newPayRate, newPayBank,
    newPayReference, newPayReceiptUrl,
    changeRate, showCustomerSearch, banks,
    setNewPayAmount, setNewPayRate, setNewPayBank, setChangeRate, setShowCustomerSearch,
    setNewPayReference, setNewPayReceiptUrl,
    handleCurrencyChange, handleMethodChange, addPaymentLine,
    cashLines, creditCOP, paidCOP, effectiveTotalCOP, rawChangeCOP, changeCOP, vueltoCOP,
    availableMethods, hasCreditLine, filteredBanks, effectiveCurrency,
  } = checkout;

  if (!show) return null;

  const saleTypeLabel = saleType === 'mixed' ? 'Mixta' : saleType === 'credit' ? 'Crédito' : 'Contado';
  const modalTitle = title || 'Confirmar Venta';
  const buttonLabel = confirmLabel || 'Confirmar Venta';

  return (
    <>
    <Modal open={show} onClose={onClose} title={modalTitle} size="lg">
      <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">

        {/* Resumen */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal:</span><span>{sSym} {fmtTotal(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between"><span>Descuento:</span><span className="text-red-600">-{sSym} {fmtTotal(discount)}</span></div>}
          {tax > 0 && <div className="flex justify-between"><span>Impuesto:</span><span>{sSym} {fmtTotal(tax)}</span></div>}
          <div className="border-t pt-1 flex justify-between font-bold text-base">
            <span>Total:</span>
            <span className="text-green-600">{sSym} {fmtTotal(total)}</span>
          </div>
          {saleType !== 'cash' && (
            <div className="flex justify-end">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${saleType === 'mixed' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                {saleTypeLabel}
              </span>
            </div>
          )}
        </div>

        {/* Cliente — only if onCustomerSelect is provided */}
        {onCustomerSelect && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Cliente</label>
            <button
              onClick={() => setShowCustomerSearch(true)}
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                customer
                  ? 'bg-blue-50 border border-blue-200 text-blue-900 hover:bg-blue-100'
                  : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <User className="w-4 h-4" />
              {customer ? getCustomerDisplayName(customer) : 'Seleccionar cliente'}
            </button>
            {customer && (
              <button onClick={() => onCustomerSelect(null)} className="mt-1 text-xs text-gray-600 hover:text-gray-900 underline">
                Limpiar selección
              </button>
            )}
          </div>
        )}

        {/* Cliente info for collect mode (no selector, just display) */}
        {!onCustomerSelect && customer && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-900 flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="font-medium">{getCustomerDisplayName(customer)}</span>
          </div>
        )}

        {/* Pagos */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-900">Pagos recibidos</label>

          {paymentLines.length > 0 && (
            <div className="space-y-1">
              {paymentLines.map((line, i) => {
                const isCreditLine = line.method === 'credit';
                const MethodIcon = isCreditLine ? CreditCard : (PAYMENT_ICONS[line.method] || Money);
                return (
                  <div key={i} className={`flex items-center justify-between rounded px-3 py-2 text-sm ${isCreditLine ? 'bg-amber-50' : 'bg-green-50'}`}>
                    <div className="flex items-center gap-2">
                      <MethodIcon className={`w-4 h-4 ${isCreditLine ? 'text-amber-700' : 'text-green-700'}`} />
                      <span className={`font-medium ${isCreditLine ? 'text-amber-800' : 'text-green-800'}`}>
                        {line.currency} {fmtLine(line.amount, line.currency)}
                      </span>
                      <span className={`text-xs ${isCreditLine ? 'text-amber-600' : 'text-green-600'}`}>
                        ({isCreditLine ? 'Crédito' : PAYMENT_METHODS.find(m => m.id === line.method)?.label}{line.bank_id ? ` - ${banks.find(b => b.id === line.bank_id)?.name || ''}` : ''})
                      </span>
                      {!isCreditLine && (line.method === 'usdt' || (line.currency !== displayCurrency && (line.display_rate || (line.currency !== 'COP' && line.cop_rate !== 1)))) && (
                        <span className="text-[10px] text-gray-400">
                          @ {line.method === 'usdt'
                            ? `${Math.ceil(line.cop_rate).toLocaleString(LOCALE)} COP/USDT`
                            : line.display_rate
                            ? `${line.currency === 'COP' ? Math.ceil(line.display_rate).toLocaleString(LOCALE) : line.display_rate.toFixed(2)} ${line.currency}/USD`
                            : `${parseFloat(String(line.cop_rate)).toFixed(2)} COP/${line.currency}`}
                        </span>
                      )}
                      {line.reference && (
                        <span className="text-[10px] text-gray-400">ref. {line.reference}</span>
                      )}
                      {line.receipt_url && (
                        <Camera className="w-3 h-3 text-green-600" aria-label="Con comprobante" />
                      )}
                    </div>
                    <button onClick={() => setPaymentLines(paymentLines.filter((_, j) => j !== i))}>
                      <X className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Credit info — only when credit is allowed */}
          {allowCredit && hasCreditLine && (
            <div className={`rounded-lg p-3 text-sm border ${customer ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
              {customer
                ? <p>Se cargará <strong>{sSym} {fmtCOP(creditCOP)}</strong> al crédito de <strong>{getCustomerDisplayName(customer)}</strong></p>
                : <p className="font-medium">Selecciona un cliente para la línea de crédito</p>
              }
            </div>
          )}

          {/* Add payment form */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
            <div className="flex gap-2 items-center">
              <select value={newPayCurrency} onChange={(e) => handleCurrencyChange(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <select value={newPayMethod} onChange={(e) => handleMethodChange(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                {availableMethods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            {(newPayMethod === 'transfer' || newPayMethod === 'usdt') && (
              <div className="flex flex-wrap gap-2 items-center">
                {newPayMethod === 'transfer' && filteredBanks.length > 0 && (
                  <select value={newPayBank} onChange={(e) => setNewPayBank(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded text-sm bg-white">
                    <option value="">Banco</option>
                    {filteredBanks.map(b => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
                  </select>
                )}
                {(effectiveCurrency !== displayCurrency || newPayMethod === 'usdt') && (
                  <span className="flex items-center gap-1">
                    <label className="text-xs text-gray-500 whitespace-nowrap">
                      {newPayMethod === 'usdt' ? 'COP/USDT' : (isUSD ? `${effectiveCurrency}/USD` : `COP/${effectiveCurrency}`)}:
                    </label>
                    <input
                      type="number"
                      value={newPayRate}
                      onChange={(e) => setNewPayRate(e.target.value)}
                      className="w-24 px-2 py-1.5 border border-blue-400 bg-white rounded text-sm text-right"
                      step="0.01"
                    />
                  </span>
                )}
                <input
                  type="text"
                  value={newPayReference}
                  onChange={(e) => setNewPayReference(e.target.value)}
                  placeholder="Referencia (opcional)"
                  className="min-w-[9rem] flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                />
                <ImageUpload
                  type="receipts"
                  compact
                  value={newPayReceiptUrl}
                  onChange={(v) => setNewPayReceiptUrl(typeof v === 'string' ? v : v[0] || '')}
                />
              </div>
            )}
            {(() => {
              const remainingCOP = effectiveTotalCOP - paidCOP;
              if (remainingCOP <= COP_TOLERANCE) return null;
              let remainingInCurrency: number;
              if (isUSD && effectiveCurrency === 'USD') {
                remainingInCurrency = remainingCOP / copPerUSD;
              } else if (isUSD && effectiveCurrency !== 'USD') {
                const customRate = parseFloat(String(newPayRate)) || 1;
                remainingInCurrency = (remainingCOP / copPerUSD) * customRate;
              } else {
                const copRate = parseFloat(String(newPayRate)) || 1;
                remainingInCurrency = remainingCOP / copRate;
              }
              const formatted = effectiveCurrency === 'USD'
                ? remainingInCurrency.toFixed(2)
                : Math.round(remainingInCurrency).toLocaleString(LOCALE);
              return (
                <p className="text-sm font-semibold text-orange-600">{formatted} {effectiveCurrency} restantes</p>
              );
            })()}
            <div className="flex gap-2">
              <input
                type="number" value={newPayAmount}
                onChange={(e) => setNewPayAmount(e.target.value)}
                placeholder={`Monto en ${effectiveCurrency}`}
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
                onKeyDown={(e) => e.key === 'Enter' && addPaymentLine()}
              />
              <button onClick={addPaymentLine} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700">
                +
              </button>
            </div>
            {/* Quick buttons — only when credit is allowed */}
            {allowCredit && (
              <div className="flex gap-1 flex-wrap">
                {!hasCreditLine && (() => {
                  const remainingForCredit = effectiveTotalCOP - paidCOP;
                  const hasPartialPayment = paidCOP > 0;
                  return remainingForCredit > 0 ? (
                    <button
                      onClick={() => {
                        if (!customer) { toast.error('Selecciona un cliente para crédito'); return; }
                        const creditLine: PaymentLine = isUSD
                          ? { currency: 'USD', method: 'credit', amount: parseFloat((remainingForCredit / copPerUSD).toFixed(2)), cop_rate: copPerUSD }
                          : { currency: 'COP', method: 'credit', amount: Math.round(remainingForCredit), cop_rate: 1 };
                        setPaymentLines([...paymentLines, creditLine]);
                      }}
                      className="px-2 py-1 bg-amber-50 border border-amber-300 text-amber-700 rounded text-xs hover:bg-amber-100"
                    >
                      {hasPartialPayment ? 'Restante a Crédito' : 'Todo a Crédito'}
                    </button>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* Payment summary */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1 border border-gray-200">
            <div className="flex justify-between"><span>Total a pagar:</span><span className="font-semibold">{sSym} {fmtCOP(effectiveTotalCOP)}</span></div>
            <div className="flex justify-between"><span>Pagado:</span><span className="font-semibold text-blue-700">{sSym} {fmtCOP(paidCOP)}</span></div>
            <div className="flex justify-between border-t pt-1">
              {changeCOP >= 0 ? (
                <><span className="font-semibold">Vuelto:</span><span className="font-bold text-green-600">{sSym} {fmtCOP(vueltoCOP)}</span></>
              ) : (
                <><span className="font-semibold text-red-600">Faltante:</span><span className="font-bold text-red-600">{sSym} {fmtCOP(Math.abs(changeCOP))}</span></>
              )}
            </div>
            {isUSD && changeCOP > 0 && (() => {
              // Misma base redondeada a 100 que usa adjustPaymentLinesForChange,
              // para que lo mostrado coincida con lo registrado
              const changeUSD = roundToNearest100COP(changeCOP) / copPerUSD;
              const rawVueltoCOP = Math.round(changeUSD * changeRate);
              const vueltoRounded = roundToNearest100COP(rawVueltoCOP);
              return (
                <div className="space-y-1 border-t border-dashed pt-1 mt-1">
                  <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
                    <span className="whitespace-nowrap">Tasa vuelto COP/USD:</span>
                    <input
                      type="number"
                      value={changeRate}
                      onChange={(e) => { const v = parseFloat(e.target.value) || 0; setChangeRate(v); saveRate('changeRate', v, 'COP'); }}
                      className="w-28 px-3 py-1.5 border border-blue-400 rounded text-right text-sm bg-white"
                      step="1"
                    />
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-green-700">
                    <span>Entregar:</span>
                    <span>COP$ {vueltoRounded.toLocaleString(LOCALE)}</span>
                  </div>
                </div>
              );
            })()}
            {isUSD && changeCOP <= 0 && paidCOP <= 0 && (
              <p className="text-xs text-blue-600 mt-1">Puedes agregar pagos en COP cambiando la moneda del selector</p>
            )}
          </div>
        </div>

        {/* Notes — only if setNotes is provided */}
        {setNotes && (
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Notas (opcional)</label>
            <Textarea
              value={notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)} rows={2}
              placeholder="Observaciones de la venta..."
            />
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="success" className="flex-1" onClick={onComplete} loading={saving}>
            {buttonLabel}
          </Button>
        </div>
      </div>
    </Modal>

    {onCustomerSelect && (
      <CustomerSearch
        isOpen={showCustomerSearch}
        onClose={() => setShowCustomerSearch(false)}
        onSelect={(c) => {
          onCustomerSelect(c as Customer);
          setShowCustomerSearch(false);
        }}
        validateCredit={saleType === 'credit' || saleType === 'mixed'}
        saleAmount={total}
        exchangeRates={exchangeRates}
      />
    )}
    </>
  );
}
