import type { Customer } from './models';
export type { Customer };

export interface CartItem {
  product_id: number;
  presentation_id: number | null;
  product_name: string;
  product_sku: string;
  presentation_name: string;
  units_per_package: number;
  quantity: number;
  sellByUnit: boolean;
  package_price: number;
  unit_price_each: number;
  unit_price: number;
  stock_units: number;
  discount_percent: number;
  tax_percent: number;
  is_frozen: boolean;
  frozen_price: number | null;
  frozen_currency: string | null;
}

export interface POSTab {
  id: string;
  name: string;
  cart: CartItem[];
  customer: Customer | null;
  createdAt: string;
}

export interface POSStoreState {
  tabs: POSTab[];
  activeTabId: string | null;
  otherReservations: Record<number, number>;
}
