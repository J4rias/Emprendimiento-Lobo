import api from './axios';

export const purchaseOrderService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/purchase-orders', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/purchase-orders', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/purchase-orders/${id}`, data);
    return response.data;
  },

  approve: async (id: number) => {
    const response = await api.post(`/purchase-orders/${id}/approve`);
    return response.data;
  },

  cancel: async (id: number, cancellation_reason: string) => {
    const response = await api.post(`/purchase-orders/${id}/cancel`, {
      cancellation_reason
    });
    return response.data;
  },

  receive: async (id: number, data: Record<string, unknown>) => {
    const response = await api.post(`/purchase-orders/${id}/receive`, data);
    return response.data;
  },

  getStats: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/purchase-orders/stats', { params });
    return response.data;
  }
};
