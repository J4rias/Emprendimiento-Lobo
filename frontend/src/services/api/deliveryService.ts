import api from './axios';

export const deliveryService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/deliveries', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/deliveries/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/deliveries', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/deliveries/${id}`, data);
    return response.data;
  },

  markAsInTransit: async (id: number) => {
    const response = await api.post(`/deliveries/${id}/in-transit`);
    return response.data;
  },

  confirm: async (id: number, data: Record<string, unknown> = {}) => {
    const response = await api.post(`/deliveries/${id}/confirm`, data);
    return response.data;
  },

  cancel: async (id: number, cancellation_reason: string) => {
    const response = await api.post(`/deliveries/${id}/cancel`, { cancellation_reason });
    return response.data;
  },

  getStats: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/deliveries/stats', { params });
    return response.data;
  }
};
