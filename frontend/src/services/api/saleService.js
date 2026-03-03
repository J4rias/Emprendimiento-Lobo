import api from './axios';

export const saleService = {
  createSale: async (saleData) => {
    const response = await api.post('/sales', saleData);
    return response.data;
  },

  getSales: async (params = {}) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  getSaleById: async (id) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },

  updateSale: async (id, data) => {
    const response = await api.put(`/sales/${id}`, data);
    return response.data;
  },

  cancelSale: async (id, reason) => {
    const response = await api.post(`/sales/${id}/cancel`, { reason });
    return response.data;
  },

  addPayment: async (id, paymentData) => {
    const response = await api.post(`/sales/${id}/payments`, paymentData);
    return response.data;
  },

  getSalesStats: async (params = {}) => {
    const response = await api.get('/sales/stats', { params });
    return response.data;
  },

  getDailyClosure: async (params = {}) => {
    const response = await api.get('/sales/daily-closure', { params });
    return response.data;
  }
};

