export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dólar' },
  { code: 'COP', symbol: 'COP', name: 'Peso Col.' },
  { code: 'VES', symbol: 'Bs', name: 'Bolívar' },
] as const;

export const CURRENCY_CODES = {
  USD: 'USD',
  COP: 'COP',
  VES: 'VES',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
  CHECK: 'check',
  OTHER: 'other',
  CREDIT_BALANCE: 'credit_balance',
  USDT: 'usdt',
} as const;

export const SALE_TYPES = {
  CASH: 'cash',
  CREDIT: 'credit',
} as const;

export const SALE_STATUSES = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  POS_LIMIT: 1000,
} as const;
