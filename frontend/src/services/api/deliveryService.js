import api from './axios';

export const deliveryService = {
  /**
   * Get all deliveries with filters
   */
  getAll: async (params = {}) => {
    const response = await api.get('/deliveries', { params });
    return response.data;
  },

  /**
   * Get delivery by ID
   */
  getById: async (id) => {
    const response = await api.get(`/deliveries/${id}`);
    return response.data;
  },

  /**
   * Create a new delivery from a sale
   */
  create: async (data) => {
    const response = await api.post('/deliveries', data);
    return response.data;
  },

  /**
   * Update delivery information
   */
  update: async (id, data) => {
    const response = await api.put(`/deliveries/${id}`, data);
    return response.data;
  },

  /**
   * Mark delivery as in transit
   */
  markAsInTransit: async (id) => {
    const response = await api.post(`/deliveries/${id}/in-transit`);
    return response.data;
  },

  /**
   * Confirm delivery as delivered
   */
  confirm: async (id, data = {}) => {
    const response = await api.post(`/deliveries/${id}/confirm`, data);
    return response.data;
  },

  /**
   * Cancel a delivery
   */
  cancel: async (id, cancellation_reason) => {
    const response = await api.post(`/deliveries/${id}/cancel`, { cancellation_reason });
    return response.data;
  },

  /**
   * Get delivery statistics
   */
  getStats: async (params = {}) => {
    const response = await api.get('/deliveries/stats', { params });
    return response.data;
  }
};
