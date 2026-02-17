import api from './axios';

export const supplierPaymentService = {
  /**
   * Get all supplier payments with filters
   */
  getAll: async (params = {}) => {
    const response = await api.get('/supplier-payments', { params });
    return response.data;
  },

  /**
   * Get supplier payment by ID
   */
  getById: async (id) => {
    const response = await api.get(`/supplier-payments/${id}`);
    return response.data;
  },

  /**
   * Create a new supplier payment
   */
  create: async (data) => {
    const response = await api.post('/supplier-payments', data);
    return response.data;
  },

  /**
   * Update a supplier payment
   */
  update: async (id, data) => {
    const response = await api.put(`/supplier-payments/${id}`, data);
    return response.data;
  },

  /**
   * Delete a supplier payment
   */
  delete: async (id) => {
    const response = await api.delete(`/supplier-payments/${id}`);
    return response.data;
  },

  /**
   * Get payments by supplier
   */
  getBySupplier: async (supplierId) => {
    const response = await api.get(`/supplier-payments/supplier/${supplierId}`);
    return response.data;
  },

  /**
   * Get payment statistics
   */
  getStats: async (params = {}) => {
    const response = await api.get('/supplier-payments/stats', { params });
    return response.data;
  }
};
