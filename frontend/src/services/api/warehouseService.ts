import api from './axios';

export const warehouseService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/inventory/warehouses', { params });
    return response.data;
  },
};
