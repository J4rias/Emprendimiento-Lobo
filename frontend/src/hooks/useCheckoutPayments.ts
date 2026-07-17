import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { calculateEffectiveRate } from '../utils/exchangeRateUtils';
import { bankService } from '../services/api/bankService';
import type { PaymentLine, ExchangeRate } from '../utils/paymentUtils';
import {
  CURRENCIES,
  PAYMENT_METHODS,
  METHODS_BY_CURRENCY,
  COP_TOLERANCE,
  getSavedRate,
  saveRate,
} from './usePOS';
import { formatCOP, formatUSD } from '../utils/formatUtils';

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
  changeRate: number;
  showCustomerSearch: boolean;
  banks: Bank[];
  // Setters
  setNewPayAmount: (v: string) => void;
  setNewPayRate: (v: number | string) => void;
  setNewPayBank: (v: string) => void;
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
    if (existingIdx >= 0) {
      const updated = [...paymentLines];
      updated[existingIdx] = { ...updated[existingIdx], amount: updated[existingIdx].amount + amount, cop_rate: copRate, ...(displayRate && { display_rate: displayRate }) };
      setPaymentLines(updated);
    } else {
      setPaymentLines([...paymentLines, { currency: backendCurrency, method: newPayMethod, amount, cop_rate: copRate, ...(displayRate && { display_rate: displayRate }), ...(bankId && { bank_id: bankId }) }]);
    }
    setNewPayAmount('');
  }, [newPayAmount, newPayMethod, newPayRate, newPayBank, isUSD, effectiveCurrency, copPerUSD, displayCurrency, paymentLines, setPaymentLines]);

  // Derived values
  const hasCreditLine = paymentLines.some(l => l.method === 'credit');
  const cashLines = paymentLines.filter(l => l.method !== 'credit');
  const creditCOP = paymentLines.filter(l => l.method === 'credit').reduce((s, l) => s + (l.amount * (parseFloat(String(l.cop_rate)) || 1)), 0);
  const paidCOP = cashLines.reduce((sum, l) => sum + (l.amount * (parseFloat(String(l.cop_rate)) || 1)), 0);
  const effectiveTotalCOP = totalCOP - creditCOP;
  const rawChangeCOP = paidCOP - effectiveTotalCOP;
  const changeCOP = Math.abs(rawChangeCOP) <= COP_TOLERANCE ? 0 : rawChangeCOP;

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
    changeRate,
    showCustomerSearch,
    banks,
    setNewPayAmount,
    setNewPayRate,
    setNewPayBank,
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
    availableMethods,
    hasCreditLine,
    filteredBanks,
    effectiveCurrency,
    getCOPRate,
  };
}
