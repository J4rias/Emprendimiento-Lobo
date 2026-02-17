import api from './axios';

export const purchaseOrderService = {
  // Get all purchase orders with filters
  getAll: async (params = {}) => {
    const response = await api.get('/purchase-orders', { params });
    return response.data;
  },

  // Get purchase order by ID
  getById: async (id) => {
    const response = await api.get(`/purchase-orders/${id}`);
    return response.data;
  },

  // Create new purchase order
  create: async (data) => {
    const response = await api.post('/purchase-orders', data);
    return response.data;
  },

  // Update purchase order (only draft)
  update: async (id, data) => {
    const response = await api.put(`/purchase-orders/${id}`, data);
    return response.data;
  },

  // Approve purchase order
  approve: async (id) => {
    const response = await api.post(`/purchase-orders/${id}/approve`);
    return response.data;
  },

  // Cancel purchase order
  cancel: async (id, cancellation_reason) => {
    const response = await api.post(`/purchase-orders/${id}/cancel`, {
      cancellation_reason
    });
    return response.data;
  },

  // Receive merchandise
  receive: async (id, data) => {
    const response = await api.post(`/purchase-orders/${id}/receive`, data);
    return response.data;
  },

  // Get purchase order statistics
  getStats: async (params = {}) => {
    const response = await api.get('/purchase-orders/stats', { params });
    return response.data;
  }
};
