import api from './axios';

export const customerService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  getActive: async () => {
    const response = await api.get('/customers', { params: { is_active: true, limit: 1000 } });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  getCreditSummary: async (id: number) => {
    const response = await api.get(`/customers/${id}/credit`);
    return response.data;
  },

  validateCredit: async (id: number, amount: number) => {
    const response = await api.get(`/customers/${id}/credit/validate`, {
      params: { amount }
    });
    return response.data;
  },

  getStats: async (id: number) => {
    const response = await api.get(`/customers/${id}/stats`);
    return response.data;
  },

  getStatement: async (id: number) => {
    const response = await api.get(`/customers/${id}/statement`);
    return response.data;
  },

  getCreditBalance: async (id: number) => {
    const response = await api.get(`/customers/${id}/credit-balance`);
    return response.data;
  }
};
