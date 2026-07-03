import api from './axios';

export const preOrderService = {
  getAll: async (params = {}) => {
    const response = await api.get('/pre-orders', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/pre-orders/${id}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/pre-orders/stats');
    return response.data;
  },

  approve: async (id) => {
    const response = await api.post(`/pre-orders/${id}/approve`);
    return response.data;
  },

  reject: async (id) => {
    const response = await api.post(`/pre-orders/${id}/reject`);
    return response.data;
  },

  convert: async (id, data = {}) => {
    const response = await api.post(`/pre-orders/${id}/convert`, data);
    return response.data;
  },
};
