import api from './axios';

export const inventoryService = {
  getByWarehouse: async (warehouseId, params = {}) => {
    const response = await api.get('/inventory', { params: { ...params, warehouse_id: warehouseId } });
    return response.data;
  },

  getAll: async (params = {}) => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },

  getByProduct: async (productId) => {
    const response = await api.get('/inventory', { params: { product_id: productId } });
    return response.data;
  },

  getLowStock: async (params = {}) => {
    const response = await api.get('/inventory/alerts/low-stock', { params });
    return response.data;
  },

  getExpiringProducts: async (params = {}) => {
    const response = await api.get('/inventory/alerts/expiring', { params });
    return response.data;
  },

  getValuation: async (params = {}) => {
    const response = await api.get('/inventory/valuation', { params });
    return response.data;
  },

  adjustInventory: async (data) => {
    const response = await api.post('/inventory/adjust', data);
    return response.data;
  },

  getMovements: async (params = {}) => {
    const response = await api.get('/inventory/movements', { params });
    return response.data;
  },
};
