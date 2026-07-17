import api from './axios';

export const supplierPaymentService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/supplier-payments', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/supplier-payments/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/supplier-payments', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/supplier-payments/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/supplier-payments/${id}`);
    return response.data;
  },

  getBySupplier: async (supplierId: number) => {
    const response = await api.get(`/supplier-payments/supplier/${supplierId}`);
    return response.data;
  },

  getPayableBalance: async (supplierId: number) => {
    const response = await api.get(`/supplier-payments/payable-balance/${supplierId}`);
    return response.data;
  },

  getCreditBalance: async (supplierId: number) => {
    const response = await api.get(`/supplier-payments/credit-balance/${supplierId}`);
    return response.data;
  },

  getStats: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/supplier-payments/stats', { params });
    return response.data;
  }
};
