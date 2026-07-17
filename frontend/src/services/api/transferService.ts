import api from './axios';

export const transferService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/transfers', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/transfers/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/transfers', data);
    return response.data;
  },

  receive: async (id: number) => {
    const response = await api.post(`/transfers/${id}/receive`);
    return response.data;
  },

  cancel: async (id: number, reason: string | null = null) => {
    const response = await api.post(`/transfers/${id}/cancel`, { reason });
    return response.data;
  }
};
