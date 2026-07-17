import api from './axios';
import type { Pagination, Quote } from '../../types';

export interface QuoteListParams {
  page?: number;
  limit?: number;
  status?: string;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
}

interface QuoteListResponse {
  data: Quote[];
  pagination: Pagination;
}

interface QuoteResponse {
  message: string;
  data: Quote;
}

export const quoteService = {
  getAll: async (params: QuoteListParams = {}): Promise<QuoteListResponse> => {
    const response = await api.get('/quotes', { params });
    return response.data;
  },

  getById: async (id: number): Promise<QuoteResponse> => {
    const response = await api.get(`/quotes/${id}`);
    return response.data;
  },

  create: async (data: Partial<Quote>): Promise<QuoteResponse> => {
    const response = await api.post('/quotes', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Quote>): Promise<QuoteResponse> => {
    const response = await api.put(`/quotes/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/quotes/${id}`);
    return response.data;
  },

  convertToSale: async (id: number, data?: unknown) => {
    const response = await api.post(`/quotes/${id}/convert`, data);
    return response.data;
  },
};
