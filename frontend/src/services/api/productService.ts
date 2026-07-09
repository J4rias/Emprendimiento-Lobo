import api from './axios';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Category {
  id: number;
  name: string;
}

interface Brand {
  id: number;
  name: string;
}

interface ProductPresentation {
  id: number;
  name: string;
  units_per_package: number;
  price: number;
  is_default: boolean;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  description?: string;
  category_id: number;
  brand_id: number;
  is_active: boolean;
  created_at: string;
  category?: Category;
  brand?: Brand;
  presentations?: ProductPresentation[];
}

interface ProductListParams {
  page?: number;
  limit?: number;
  search?: string;
  category_id?: number;
  brand_id?: number;
  is_active?: boolean;
}

interface ProductListResponse {
  data: Product[];
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