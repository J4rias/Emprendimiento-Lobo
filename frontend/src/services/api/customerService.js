import api from './axios';

export const customerService = {
  // Get all customers with filters
  getAll: async (params = {}) => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  // Get active customers (for dropdowns)
  getActive: async () => {
    const response = await api.get('/customers/active');
    return response.data;
  },

  // Get customer by ID
  getById: async (id) => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  // Create new customer
  create: async (data) => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  // Update customer
  update: async (id, data) => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  // Delete customer (soft delete)
  delete: async (id) => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  // Get credit summary
  getCreditSummary: async (id) => {
    const response = await api.get(`/customers/${id}/credit`);
    return response.data;
  },

  validateCredit: async (id, amount) => {
    const response = await api.get(`/customers/${id}/credit/validate`, {
      params: { amount }
    });
    return response.data;
  },

  // Get customer statistics
  getStats: async (id) => {
    const response = await api.get(`/customers/${id}/stats`);
    return response.data;
  },

  // Get customer statement (ledger)
  getStatement: async (id) => {
    const response = await api.get(`/customers/${id}/statement`);
    return response.data;
  }
};
