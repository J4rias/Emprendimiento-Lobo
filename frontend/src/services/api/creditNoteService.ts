import api from './axios';

export const creditNoteService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/credit-notes', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/credit-notes/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/credit-notes', data);
    return response.data;
  },

  approve: async (id: number) => {
    const response = await api.post(`/credit-notes/${id}/approve`);
    return response.data;
  },

  cancel: async (id: number, cancellation_reason: string) => {
    const response = await api.post(`/credit-notes/${id}/cancel`, { cancellation_reason });
    return response.data;
  },

  getStats: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/credit-notes/stats', { params });
    return response.data;
  }
};
