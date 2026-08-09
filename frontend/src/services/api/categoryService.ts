import api from './axios';
import type { Pagination, Category } from '../../types';

export interface CategoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

interface CategoryListResponse {
  data: Category[];
  pagination: Pagination;
}

interface CategoryResponse {
  message: string;
  data: Category;
}

export const categoryService = {
  getAll: async (params: CategoryListParams = {}): Promise<CategoryListResponse> => {
    const response = await api.get('/categories', { params });
    return response.data;
  },

  getWithProductCount: async (): Promise<CategoryListResponse> => {
    const response = await api.get('/categories', { params: { limit: 1000 } });
    return response.data;
  },

  getById: async (id: number): Promise<CategoryResponse> => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  create: async (categoryData: Partial<Category>): Promise<CategoryResponse> => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },

  update: async (id: number, categoryData: Partial<Category>): Promise<CategoryResponse> => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};
