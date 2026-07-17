import api from './axios';
import type { Pagination, Product } from '../../types';

export interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: number;
  brand_id?: number;
  is_active?: boolean;
  price_list_id?: number;
}

export interface ProductListResponse {
  data: Product[];
  products?: Product[];
  pagination: Pagination;
}

interface ProductResponse {
  data: Product;
}

export const productService = {
  getAll: async (params: ProductListParams = {}): Promise<ProductListResponse> => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  getById: async (id: number): Promise<ProductResponse> => {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  searchByBarcode: async (barcode: string): Promise<ProductResponse> => {
    const response = await api.get('/products', { params: { barcode } });
    return response.data;
  },

  create: async (data: Partial<Product>): Promise<ProductResponse> => {
    const response = await api.post('/products', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Product>): Promise<ProductResponse> => {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/products/${id}`);
  },
} as const;
