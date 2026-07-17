// ── Brand ──
export interface Brand {
  id: number;
  name: string;
  is_active: boolean;
  product_count?: number;
}

// ── Category ──
export interface Category {
  id: number;
  name: string;
  description?: string;
  product_count?: number;
  is_active: boolean;
}

// ── Product ──
export interface ProductPresentation {
  id: number;
  name: string;
  units_per_package: number;
  price: number;
  is_default: boolean;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  description?: string;
  category_id: number;
  brand_id: number;
  is_active: boolean;
  created_at: string;
  category?: Pick<Category, 'id' | 'name'>;
  brand?: Pick<Brand, 'id' | 'name'>;
  presentations?: ProductPresentation[];
  barcodes?: { barcode: string; [key: string]: unknown }[];
  inventories?: { quantity: number | string; [key: string]: unknown }[];
}

// ── Customer ──
export interface Customer {
  id: number;
  type: 'natural' | 'juridica';
  firstName?: string;
  lastName?: string;
  businessName?: string;
  tradeName?: string;
  [key: string]: unknown;
}

// ── Sale ──
export interface SalePayment {
  id: number;
  method: string;
  amount: number;
  currency: string;
}

export interface SaleDetail {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Sale {
  id: number;
  sale_number: string;
  sale_type: 'cash' | 'credit' | 'mixed' | 'pos_pending';
  status: 'completed' | 'pending' | 'cancelled';
  total: number;
  exchange_rate: number;
  notes?: string;
  sale_date: string;
  customer_id?: number;
  warehouse_id: number;
  payments?: SalePayment[];
  details?: SaleDetail[];
}

// ── Exchange Rate ──
export interface ExchangeRate {
  id: number;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
  source?: string;
  notes?: string;
  is_active?: boolean;
  created_at: string;
  [key: string]: unknown;
}

// ── Inventory ──
export interface InventoryItem {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  min_stock?: number;
  product?: Product;
  warehouse?: { id: number; name: string };
}

// ── Quote ──
export interface QuoteItem {
  product_id: number;
  presentation_id: number;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Quote {
  id: number;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  customer_id?: number;
  total: number;
  notes?: string;
  valid_until?: string;
  created_at: string;
  items?: QuoteItem[];
}

// ── PreOrder ──
export interface PreOrder {
  id: number;
  code: string;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  customer_id?: number;
  notes?: string;
  created_at: string;
  items?: unknown[];
}

// ── Bank ──
export interface Bank {
  id: number;
  name: string;
  currency: string;
  [key: string]: unknown;
}

// ── Payment ──
export interface PaymentLine {
  currency: string;
  method: string;
  amount: number;
  cop_rate: number;
  display_rate?: number;
  bank_id?: number | null;
}

export interface BackendPaymentLine {
  currency: string;
  method: string;
  amount: number;
  exchange_rate: number;
  bank_id?: number | null;
}
