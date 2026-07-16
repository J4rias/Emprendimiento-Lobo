import { calculateEffectiveRate } from './exchangeRateUtils';

// ============= TYPES =============

export interface PaymentLine {
  currency: string;
  method: string;
  amount: number;
  cop_rate: number;
  display_rate?: number;
  bank_id?: number;
}

export interface BackendPaymentLine {
  currency: string;
  method: string;
  amount: number;
  exchange_rate: number;
  bank_id?: number;
}

export interface ExchangeRate {
  id: number;
  baseCurrency: string;
  targetCurrency: string;
  rate: number | string;
  [key: string]: unknown;
}

export interface AdjustResult {
  adjustedLines: PaymentLine[];
  changeCOP: number;
  changeAmount: string;
}

export interface Customer {
  id: number;
  type: 'natural' | 'juridica';
  firstName?: string;
  lastName?: string;
  businessName?: string;
  tradeName?: string;
  [key: string]: unknown;
}

// ============= CONSTANTS =============

const COP_TOLERANCE = 40;

// ============= FUNCTIONS =============

/**
 * Converts frontend payment lines to backend format with proper exchange_rate.
 * Extracted from usePOS.js convertPaymentLinesToBackend.
 */
export function convertPaymentLinesToBackend(
  lines: PaymentLine[],
  exchangeRates: ExchangeRate[],
): BackendPaymentLine[] {
  const copPerUSD = calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
  return lines.map(line => {
    const base: BackendPaymentLine = {
      currency: line.currency,
      method: line.method,
      amount: line.amount,
      exchange_rate: copPerUSD,
      ...(line.bank_id && { bank_id: line.bank_id }),
    };
    if (line.currency === 'USD') {
      base.exchange_rate = copPerUSD / (parseFloat(String(line.cop_rate)) || copPerUSD);
      return base;
    }
    if (line.currency === 'VES') {
      base.exchange_rate = copPerUSD / (parseFloat(String(line.cop_rate)) || 1);
      return base;
    }
    // COP: use cop_rate to derive exchange_rate (handles custom rates in USD mode)
    const copRate = parseFloat(String(line.cop_rate)) || 1;
    base.exchange_rate = copPerUSD / copRate;
    return base;
  });
}

/**
 * Adjusts payment lines by deducting change (vuelto).
 * 3-step deduction: COP cash → USD cash (if USD mode) → fallback negative COP line.
 * Extracted from usePOS.js performSale.
 */
export function adjustPaymentLinesForChange(
  paymentLines: PaymentLine[],
  totalCOP: number,
  copPerUSD: number,
  displayCurrency: string,
  copTolerance: number = COP_TOLERANCE,
): AdjustResult {
  const paidCOP = paymentLines
    .filter(l => l.method !== 'credit')
    .reduce((sum, l) => sum + (l.amount * (parseFloat(String(l.cop_rate)) || 1)), 0);
  const creditCOP = paymentLines
    .filter(l => l.method === 'credit')
    .reduce((s, l) => s + (l.amount * (parseFloat(String(l.cop_rate)) || 1)), 0);
  const rawChangeCOP = paidCOP - (totalCOP - creditCOP);
  const changeCOP = Math.abs(rawChangeCOP) <= copTolerance ? 0 : Math.max(0, rawChangeCOP);
  const changeAmount = (changeCOP / copPerUSD).toFixed(2);

  let adjustedLines = paymentLines;
  if (changeCOP > 0) {
    adjustedLines = [...paymentLines];
    let remainingChange = changeCOP;

    // 1. Deduct from COP cash lines first
    for (let i = adjustedLines.length - 1; i >= 0 && remainingChange > copTolerance; i--) {
      const line = adjustedLines[i];
      if (line.method !== 'credit' && line.currency === 'COP') {
        const deductible = Math.min(remainingChange, line.amount);
        adjustedLines[i] = { ...line, amount: line.amount - deductible };
        remainingChange -= deductible;
      }
    }

    // 2. Deduct from non-COP cash lines (USD, VES, etc.) using their cop_rate
    if (remainingChange > copTolerance) {
      for (let i = adjustedLines.length - 1; i >= 0 && remainingChange > copTolerance; i--) {
        const line = adjustedLines[i];
        if (line.method !== 'credit' && line.currency !== 'COP') {
          const copRate = parseFloat(String(line.cop_rate)) || 1;
          const lineMaxCOP = line.amount * copRate;
          const deductCOP = Math.min(remainingChange, lineMaxCOP);
          const deductNative = deductCOP / copRate;
          adjustedLines[i] = { ...line, amount: parseFloat((line.amount - deductNative).toFixed(2)) };
          remainingChange -= deductCOP;
        }
      }
    }

    // 3. Fallback: negative COP line (should rarely happen now)
    if (remainingChange > copTolerance) {
      adjustedLines.push({
        currency: 'COP',
        method: 'cash',
        amount: -Math.round(remainingChange),
        cop_rate: 1,
      });
    }
  }

  return { adjustedLines, changeCOP, changeAmount };
}

/**
 * Returns a display name for a customer object.
 * Extracted from POSPageNew.jsx CheckoutModal.
 */
export function getCustomerDisplayName(c: Customer | null | undefined): string | null {
  if (!c) return null;
  if (c.type === 'natural') return `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Sin nombre';
  return c.businessName || c.tradeName || 'Sin nombre';
}
