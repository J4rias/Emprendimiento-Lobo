import api from './axios';

export const supplierService = {
  // Get all suppliers
  getAll: async (params = {}) => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  // Get active suppliers (for dropdowns)
  getActive: async () => {
    const response = await api.get('/suppliers', {
      params: { is_active: true, limit: 1000 }
    });
    return response.data;
  },

  // Get supplier by ID
  getById: async (id) => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  // Create supplier
  create: async (data) => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  // Update supplier
  update: async (id, data) => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  // Delete supplier
  delete: async (id) => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  // Get supplier ledger grouped by category (USD/DIVISAS/COP)
  getLedger: async (id) => {
    const response = await api.get(`/suppliers/${id}/ledger`);
    return response.data;
  },

  // Get resumen de proveedores (all suppliers with balances by category)
  getResumen: async () => {
    const response = await api.get('/suppliers/resumen');
    return response.data;
  }
};
