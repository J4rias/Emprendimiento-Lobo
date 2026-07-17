import api from './axios';

export const supplierService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  getActive: async () => {
    const response = await api.get('/suppliers', {
      params: { is_active: true, limit: 1000 }
    });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  getLedger: async (id: number) => {
    const response = await api.get(`/suppliers/${id}/ledger`);
    return response.data;
  },

  getResumen: async () => {
    const response = await api.get('/suppliers/resumen');
    return response.data;
  }
};
