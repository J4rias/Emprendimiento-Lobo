import api from './axios';

export interface CatalogProduct {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  packaging: string | null;
  units_per_package: number;
  package_price: number;
  unit_price: number;
  image_url: string | null;
  low_stock: boolean;
}

export interface CatalogCategory {
  id: number;
  name: string;
}

export interface CatalogCompany {
  name: string;
  tax_id?: string;
  address?: string;
  phone?: string;
}

export interface CatalogData {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  company: CatalogCompany | null;
  topProducts: number[];
  newArrivals: number[];
}

export const catalogService = {
  get: () => api.get<CatalogData>('/catalog'),
};
