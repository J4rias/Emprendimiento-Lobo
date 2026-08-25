import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { bankService } from '../services/api/bankService';
import type { PaymentLine } from '../utils/paymentUtils';
import type { ExchangeRate } from '../utils/paymentUtils';
import {
  CURRENCIES,
  PAYMENT_METHODS,
  METHODS_BY_CURRENCY,
  COP_TOLERANCE,
  getSavedRate,
  saveRate,
} from './usePOS';
import { formatCOP, formatUSD } from '../utils/formatUtils';
import { roundToNearest100COP } from '../utils/paymentUtils';

// ============= TYPES =============

interface Bank {
  id: number;
  name: string;
  currency: string;
  [key: string]: unknown;
}

interface UseCheckoutPaymentsInput {
  paymentLines: PaymentLine[];
  setPaymentLines: (lines: PaymentLine[]) => void;
  totalCOP: number;
  copPerUSD: number;
  displayCurrency: string;
  exchangeRates: ExchangeRate[];
}

export interface UseCheckoutPaymentsReturn {
  // State
  newPayCurrency: string;
  newPayMethod: string;
  newPayAmount: string;
  newPayRate: number | string;
  newPayBank: string;
  newPayReference: string;
  newPayReceiptUrl: string;
  changeRate: number;
  showCustomerSearch: boolean;
  banks: Bank[];
  // Setters
  setNewPayAmount: (v: string) => void;
  setNewPayRate: (v: number | string) => void;
  setNewPayBank: (v: string) => void;
  setNewPayReference: (v: string) => void;
  setNewPayReceiptUrl: (v: string) => void;
  setChangeRate: (v: number) => void;
  setShowCustomerSearch: (v: boolean) => void;
  // Handlers
  handleCurrencyChange: (code: string) => void;
  handleMethodChange: (method: string) => void;
  addPaymentLine: () => void;
  // Derived
  isUSD: boolean;
  sSym: string;
  fmtTotal: (usdVal: number) => string;
  fmtCOP: (copVal: number) => string;
  fmtLine: (amount: number | string, currency: string) => string;
  cashLines: PaymentLine[];
  creditCOP: number;
  paidCOP: number;
  effectiveTotalCOP: number;
  rawChangeCOP: number;
  changeCOP: number;
  vueltoCOP: number;
  availableMethods: typeof PAYMENT_METHODS;
  hasCreditLine: boolean;
  filteredBanks: Bank[];
  effectiveCurrency: string;
  getCOPRate: (code: string) => number;
}

// ============= HOOK =============

export function useCheckoutPayments({
  paymentLines,
  setPaymentLines,
  totalCOP,
  copPerUSD,
  displayCurrency,
  exchangeRates,
}: UseCheckoutPaymentsInput): UseCheckoutPaymentsReturn {
  const isUSD = displayCurrency === 'USD';
  const sSym = isUSD ? '$' : 'COP$';

  const getCOPRate = useCallback((code: string): number => {
    if (isUSD && code === 'USD') return copPerUSD;
    if (code === displayCurrency) return code === 'COP' ? 1 : (getSavedRate(code, displayCurrency) || calculateEffectiveRate(code, 'COP', exchangeRates) || 1);
    return getSavedRate(code, displayCurrency) || calculateEffectiveRate(code, 'COP', exchangeRates) || 1;
  }, [isUSD, copPerUSD, displayCurrency, exchangeRates]);

  // State
  const [newPayCurrency, setNewPayCurrency] = useState(isUSD ? 'USD' : 'COP');
  const [newPayMethod, setNewPayMethod] = useState('cash');
  const [newPayAmount, setNewPayAmount] = useState('');
  const [newPayRate, setNewPayRate] = useState<number | string>(() => getCOPRate(isUSD ? 'USD' : 'COP'));
  const [newPayBank, setNewPayBank] = useState('');
  const [newPayReference, setNewPayReference] = useState('');
  const [newPayReceiptUrl, setNewPayReceiptUrl] = useState('');
  const [changeRate, setChangeRate] = useState(() => getSavedRate('changeRate', 'COP') || Math.round(copPerUSD));
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);

  // Effects
  useEffect(() => {
    bankService.getAll().then((res: any) => setBanks(Array.isArray(res) ? res : res?.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const def = isUSD ? 'USD' : 'COP';
    setNewPayCurrency(def);
    setNewPayMethod('cash');
    setNewPayAmount('');
    setNewPayRate(getCOPRate(def));
    setNewPayBank('');
    setNewPayReference('');
    setNewPayReceiptUrl('');
  }, [displayCurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleCurrencyChange = useCallback((code: string) => {
    setNewPayCurrency(code);
    if (isUSD && code !== 'USD') {
      setNewPayRate(getSavedRate(code, 'USD') || calculateEffectiveRate('USD', code, exchangeRates) || 1);
    } else {
      setNewPayRate(getCOPRate(code));
    }
    const allowed = METHODS_BY_CURRENCY[code as keyof typeof METHODS_BY_CURRENCY] || ['cash'];
    setNewPayMethod((prev: string) => allowed.includes(prev) ? prev : allowed[0]);
  }, [isUSD, exchangeRates, getCOPRate]);

  const handleMethodChange = useCallback((method: string) => {
    setNewPayMethod(method);
    setNewPayBank('');
    setNewPayReference('');
    setNewPayReceiptUrl('');
    if (method === 'usdt') {
      setNewPayRate(getSavedRate('usdt', 'COP') || copPerUSD);
    } else {
      // Switching away from USDT — restore normal rate
      // We need to check current method, but since we just set it, use the incoming value
      setNewPayCurrency(prev => {
        // Trigger rate restore via currency
        setNewPayRate(getCOPRate(prev));
        return prev;
      });
    }
  }, [copPerUSD, getCOPRate]);

  const effectiveCurrency = newPayCurrency;
  const filteredBanks = banks.filter(b => b.currency === effectiveCurrency);

  const addPaymentLine = useCallback(() => {
    const amount = parseFloat(newPayAmount);
    if (!amount || amount <= 0) { toast.error('Ingresa un monto válido'); return; }
    let copRate: number;
    const isUSDT = newPayMethod === 'usdt';
    if (isUSDT) {
      copRate = parseFloat(String(newPayRate)) || copPerUSD;
      saveRate('usdt', copRate, 'COP');
    } else if (isUSD && effectiveCurrency === 'USD') {
      copRate = copPerUSD;
    } else if (isUSD && effectiveCurrency !== 'USD') {
      copRate = copPerUSD / (parseFloat(String(newPayRate)) || 1);
      saveRate(effectiveCurrency, parseFloat(String(newPayRate)), 'USD');
    } else if (effectiveCurrency === 'COP') {
      copRate = 1;
    } else {
      copRate = parseFloat(String(newPayRate)) || 1;
      if (effectiveCurrency !== displayCurrency) saveRate(effectiveCurrency, copRate, 'COP');
    }
    const backendCurrency = isUSDT ? 'USD' : effectiveCurrency;
    const displayRate = (isUSD && effectiveCurrency !== 'USD') ? (parseFloat(String(newPayRate)) || 1) : null;
    const existingIdx = (displayRate || isUSDT)
      ? -1
      : paymentLines.findIndex(l => l.currency === backendCurrency && l.method === newPayMethod);
    const bankId = (newPayMethod === 'transfer' && newPayBank) ? parseInt(newPayBank) : undefined;
    const canHaveReceipt = newPayMethod === 'transfer' || newPayMethod === 'usdt';
    const reference = (canHaveReceipt && newPayReference.trim()) ? newPayReference.trim() : undefined;
    const receiptUrl = (canHaveReceipt && newPayReceiptUrl) ? newPayReceiptUrl : undefined;
    // Con referencia/foto no se acumula en una línea existente: cada comprobante
    // es una operación bancaria distinta, aunque coincidan moneda y método.
    const idx = (reference || receiptUrl) ? -1 : existingIdx;
    if (idx >= 0) {
      const updated = [...paymentLines];
      updated[idx] = { ...updated[idx], amount: updated[idx].amount + amount, cop_rate: copRate, ...(displayRate && { display_rate: displayRate }) };
      setPaymentLines(updated);
    } else {
      setPaymentLines([...paymentLines, {
        currency: backendCurrency, method: newPayMethod, amount, cop_rate: copRate,
        ...(displayRate && { display_rate: displayRate }),
        ...(bankId && { bank_id: bankId }),
        ...(reference && { reference }),
        ...(receiptUrl && { receipt_url: receiptUrl }),
      }]);
    }
    setNewPayAmount('');
    setNewPayReference('');
    setNewPayReceiptUrl('');
  }, [newPayAmount, newPayMethod, newPayRate, newPayBank, newPayReference, newPayReceiptUrl, isUSD, effectiveCurrency, copPerUSD, displayCurrency, paymentLines, setPaymentLines]);

  // Derived values
  const hasCreditLine = paymentLines.some(l => l.method === 'credit');
  const cashLines = paymentLines.filter(l => l.method !== 'credit');
  const lineCOP = (l: PaymentLine) => Math.round(l.amount * (parseFloat(String(l.cop_rate)) || 1));
  const creditCOP = paymentLines.filter(l => l.method === 'credit').reduce((s, l) => s + lineCOP(l), 0);
  const paidCOP = cashLines.reduce((sum, l) => sum + lineCOP(l), 0);
  // Math.round: mismo tratamiento que adjustPaymentLinesForChange (elimina ruido float del total)
  const effectiveTotalCOP = Math.round(totalCOP) - creditCOP;
  const rawChangeCOP = paidCOP - effectiveTotalCOP;
  const changeCOP = Math.abs(rawChangeCOP) <= COP_TOLERANCE ? 0 : rawChangeCOP;
  // Vuelto rounded to nearest 100 COP (smallest bill denomination for change)
  const vueltoCOP = changeCOP > 0 ? roundToNearest100COP(changeCOP) : 0;

  const availableMethods = PAYMENT_METHODS.filter(m =>
    (METHODS_BY_CURRENCY[effectiveCurrency as keyof typeof METHODS_BY_CURRENCY] || ['cash']).includes(m.id)
  );

  const fmtTotal = useCallback((usdVal: number) =>
    isUSD ? formatUSD(usdVal).replace('$ ', '') : formatCOP(usdVal * copPerUSD).replace('COP ', ''),
  [isUSD, copPerUSD]);

  const fmtCOP = useCallback((copVal: number) =>
    isUSD ? formatUSD(copVal / copPerUSD).replace('$ ', '') : formatCOP(copVal).replace('COP ', ''),
  [isUSD, copPerUSD]);

  const fmtLine = useCallback((amount: number | string, currency: string) => {
    const n = parseFloat(String(amount)) || 0;
    if (currency === 'COP') return formatCOP(n).replace('COP ', '');
    return formatUSD(n).replace('$ ', '');
  }, []);

  return {
    newPayCurrency,
    newPayMethod,
    newPayAmount,
    newPayRate,
    newPayBank,
    newPayReference,
    newPayReceiptUrl,
    changeRate,
    showCustomerSearch,
    banks,
    setNewPayAmount,
    setNewPayRate,
    setNewPayBank,
    setNewPayReference,
    setNewPayReceiptUrl,
    setChangeRate,
    setShowCustomerSearch,
    handleCurrencyChange,
    handleMethodChange,
    addPaymentLine,
    isUSD,
    sSym,
    fmtTotal,
    fmtCOP,
    fmtLine,
    cashLines,
    creditCOP,
    paidCOP,
    effectiveTotalCOP,
    rawChangeCOP,
    changeCOP,
    vueltoCOP,
    availableMethods,
    hasCreditLine,
    filteredBanks,
    effectiveCurrency,
    getCOPRate,
  };
}
