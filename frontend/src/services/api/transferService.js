import api from './axios';

export const transferService = {
  getAll: async (params = {}) => {
    const response = await api.get('/transfers', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/transfers/${id}`);
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/transfers', data);
    return response.data;
  },

  receive: async (id) => {
    const response = await api.post(`/transfers/${id}/receive`);
    return response.data;
  },

  cancel: async (id, reason = null) => {
    const response = await api.post(`/transfers/${id}/cancel`, { reason });
    return response.data;
  }
};
