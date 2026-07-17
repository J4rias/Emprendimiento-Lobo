import api from './axios';

export const warehouseService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/inventory/warehouses', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/inventory/warehouses/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/inventory/warehouses', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/inventory/warehouses/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/inventory/warehouses/${id}`);
    return response.data;
  }
};
