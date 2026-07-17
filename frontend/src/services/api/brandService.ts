import api from './axios';
import type { Pagination, Brand } from '../../types';

export type { Brand };

interface BrandListResponse {
  data: Brand[];
  pagination: Pagination;
}

interface BrandResponse {
  message: string;
  data: Brand;
}

export const brandService = {
  getAll: async (params?: Record<string, unknown>): Promise<BrandListResponse> => {
    const response = await api.get('/brands', { params });
    return response.data;
  },

  getActive: async (): Promise<BrandListResponse> => {
    const response = await api.get('/brands', { params: { is_active: true } });
    return response.data;
  },

  getById: async (id: number): Promise<BrandResponse> => {
    const response = await api.get(`/brands/${id}`);
    return response.data;
  },

  create: async (data: Omit<Brand, 'id'>): Promise<BrandResponse> => {
    const response = await api.post('/brands', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Omit<Brand, 'id'>>): Promise<BrandResponse> => {
    const response = await api.put(`/brands/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/brands/${id}`);
  },
};
