import api from './axios';
import type { Pagination, ExchangeRate } from '../../types';

interface ExchangeRateListResponse {
  data: ExchangeRate[];
  pagination: Pagination;
}

interface ExchangeRateResponse {
  message: string;
  data: ExchangeRate;
}

interface ConvertResponse {
  data: { from: string; to: string; amount: number; result: number; rate: number };
}

export interface ExchangeRateParams {
  page?: number;
  limit?: number;
  pair?: string;
  is_active?: boolean;
  date_from?: string;
  date_to?: string;
}

export const exchangeRateService = {
  getLatest: async () => {
    const response = await api.get('/exchange-rates/latest');
    return response.data;
  },

  convert: async (amount: number, from: string = 'USD', to: string = 'VES'): Promise<ConvertResponse> => {
    const response = await api.get('/exchange-rates/convert', {
      params: { amount, from_currency: from, to_currency: to }
    });
    return response.data;
  },

  getAll: async (params: ExchangeRateParams = {}): Promise<ExchangeRateListResponse> => {
    const response = await api.get('/exchange-rates', { params });
    return response.data;
  },

  create: async (data: Partial<ExchangeRate>): Promise<ExchangeRateResponse> => {
    const response = await api.post('/exchange-rates', data);
    return response.data;
  },

  update: async (id: number, data: Partial<ExchangeRate>): Promise<ExchangeRateResponse> => {
    const response = await api.put(`/exchange-rates/${id}`, data);
    return response.data;
  },

  deleteRate: async (id: number): Promise<void> => {
    await api.delete(`/exchange-rates/${id}`);
  }
};
