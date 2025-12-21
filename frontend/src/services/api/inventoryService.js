import api from './axios';

export const inventoryService = {
  getByWarehouse: async (warehouseId, params = {}) => {
    const response = await api.get(`/inventory/warehouse/${warehouseId}`, { params });
    return response.data;
  },

  getByProduct: async (productId) => {
    const response = await api.get(`/inventory/product/${productId}`);
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
};
