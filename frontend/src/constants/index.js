// Currencies supported by the system
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'Dólar' },
  { code: 'COP', symbol: 'COP', name: 'Peso Col.' },
  { code: 'VES', symbol: 'Bs', name: 'Bolívar' },
];

export const CURRENCY_CODES = {
  USD: 'USD',
  COP: 'COP',
  VES: 'VES',
};

// Payment methods
export const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',
  TRANSFER: 'transfer',
  CHECK: 'check',
  OTHER: 'other',
  CREDIT_BALANCE: 'credit_balance',
};

// Sale types
export const SALE_TYPES = {
  CASH: 'cash',
  CREDIT: 'credit',
};

// Sale statuses
export const SALE_STATUSES = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  CANCELLED: 'cancelled',
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  POS_LIMIT: 1000,
};
