import { calculateEffectiveRate } from './exchangeRateUtils';
import type { RateRecord } from './exchangeRateUtils';

// ============= TYPES =============

export interface PaymentLine {
  currency: string;
  method: string;
  amount: number;
  cop_rate: number;
  display_rate?: number;
  bank_id?: number;
  reference?: string | null;
  receipt_url?: string | null;
}

export interface BackendPaymentLine {
  currency: string;
  method: string;
  amount: number;
  exchange_rate: number;
  bank_id?: number;
  reference?: string | null;
  receipt_url?: string | null;
}

// Re-export RateRecord as ExchangeRate for backward compatibility
export type ExchangeRate = RateRecord;

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

// ============= HELPERS =============

/**
 * Rounds a COP amount to the nearest 100 (smallest bill denomination).
 * Business rule: vueltos are always given in multiples of 100 COP.
 * Examples: 1101 → 1100, 1263 → 1300, 550 → 600.
 */
export function roundToNearest100COP(amount: number): number {
  return Math.round(amount / 100) * 100;
}

// ============= FUNCTIONS =============

/**
 * Converts frontend payment lines to backend format with proper exchange_rate.
 * Extracted from usePOS.js convertPaymentLinesToBackend.
 */
export function convertPaymentLinesToBackend(
  lines: PaymentLine[],
  exchangeRates: ExchangeRate[],
  copPerUSDOverride?: number,
): BackendPaymentLine[] {
  const copPerUSD = copPerUSDOverride || calculateEffectiveRate('USD', 'COP', exchangeRates) || 1;
  return lines.map(line => {
    const base: BackendPaymentLine = {
      currency: line.currency,
      method: line.method,
      amount: line.amount,
      exchange_rate: copPerUSD,
      ...(line.bank_id && { bank_id: line.bank_id }),
      ...(line.reference && { reference: line.reference }),
      ...(line.receipt_url && { receipt_url: line.receipt_url }),
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
  // Tasa COP/USD a la que se entrega físicamente el vuelto (editable en el
  // modal en modo USD). Si difiere de copPerUSD, la línea negativa registra
  // los COP realmente entregados con su exchange_rate correspondiente.
  changeDeliveryRate: number = copPerUSD,
): AdjustResult {
  // Round totalCOP to integer to eliminate floating-point noise (e.g. 59000.0001 → 59000)
  const totalCOPRounded = Math.round(totalCOP);

  // Use Math.round per line to match useCheckoutPayments.lineCOP exactly
  const lineCOP = (l: PaymentLine) => Math.round(l.amount * (parseFloat(String(l.cop_rate)) || 1));
  const paidCOP = paymentLines
    .filter(l => l.method !== 'credit')
    .reduce((sum, l) => sum + lineCOP(l), 0);
  const creditCOP = paymentLines
    .filter(l => l.method === 'credit')
    .reduce((s, l) => s + lineCOP(l), 0);
  const rawChangeCOP = paidCOP - (totalCOPRounded - creditCOP);
  // Redondear a 100 desde el inicio: el cajero entrega el vuelto redondeado,
  // así lo registrado coincide con lo mostrado/entregado físicamente
  const changeCOP = Math.abs(rawChangeCOP) <= copTolerance ? 0 : roundToNearest100COP(Math.max(0, rawChangeCOP));
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

    // 2. Remaining change → vuelto always given in COP cash (ya redondeado a 100)
    if (remainingChange > copTolerance) {
      const deliveryRate = changeDeliveryRate > 0 ? changeDeliveryRate : copPerUSD;
      if (deliveryRate !== copPerUSD) {
        // Vuelto entregado a tasa distinta (modo USD con tasa editable): registrar
        // los COP físicos entregados; cop_rate ajusta el equivalente USD
        const deliveredCOP = roundToNearest100COP(Math.round((remainingChange / copPerUSD) * deliveryRate));
        adjustedLines.push({
          currency: 'COP',
          method: 'cash',
          amount: -deliveredCOP,
          cop_rate: deliveryRate > 0 ? copPerUSD / deliveryRate : 1,
        });
      } else {
        adjustedLines.push({
          currency: 'COP',
          method: 'cash',
          amount: -remainingChange,
          cop_rate: 1,
        });
      }
    }
  }

  // Filter out zero-amount lines (fully deducted COP); keep negative lines (vuelto in COP)
  const filtered = adjustedLines.filter(l => l.amount !== 0);
  return { adjustedLines: filtered, changeCOP, changeAmount };
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
