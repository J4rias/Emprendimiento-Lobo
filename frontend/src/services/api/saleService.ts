import api from './axios';
import type { Sale, SalePayment } from '../../types';

export interface SaleListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sale_type?: string;
  customer_id?: number;
  warehouse_id?: number;
  date_from?: string;
  date_to?: string;
}

export const saleService = {
  createSale: async (saleData: Partial<Sale> & Record<string, unknown>) => {
    const response = await api.post('/sales', saleData);
    return response.data;
  },

  getSales: async (params: SaleListParams = {}) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  getSaleById: async (id: number) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },

  getBySaleNumber: async (saleNumber: string) => {
    const response = await api.get('/sales', { params: { sale_number: saleNumber } });
    return response.data;
  },

  updateSale: async (id: number, data: Partial<Sale>) => {
    const response = await api.patch(`/sales/${id}`, data);
    return response.data;
  },

  cancelSale: async (id: number, reason: string) => {
    const response = await api.post(`/sales/${id}/cancel`, { reason });
    return response.data;
  },

  addPayment: async (id: number, paymentData: SalePayment) => {
    const response = await api.post(`/sales/${id}/payments`, paymentData);
    return response.data;
  },

  getSalesStats: async (params: Record<string, string> = {}) => {
    const response = await api.get('/sales/stats', { params });
    return response.data;
  },

  getProductSales: async (params: Record<string, string> = {}) => {
    const response = await api.get('/sales/product-sales', { params });
    return response.data;
  },

  getDailyClosure: async (params: Record<string, string> = {}) => {
    const response = await api.get('/sales/daily-closure', { params });
    return response.data;
  },

  validateCreditPin: async (pin: string) => {
    const response = await api.post('/sales/validate-credit-pin', { pin });
    return response.data;
  }
};
