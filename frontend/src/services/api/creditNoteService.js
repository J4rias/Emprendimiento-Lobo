import api from './axios';

export const creditNoteService = {
  /**
   * Get all credit notes with filters
   */
  getAll: async (params = {}) => {
    const response = await api.get('/credit-notes', { params });
    return response.data;
  },

  /**
   * Get credit note by ID
   */
  getById: async (id) => {
    const response = await api.get(`/credit-notes/${id}`);
    return response.data;
  },

  /**
   * Create a new credit note
   */
  create: async (data) => {
    const response = await api.post('/credit-notes', data);
    return response.data;
  },

  /**
   * Approve and apply a credit note
   */
  approve: async (id) => {
    const response = await api.post(`/credit-notes/${id}/approve`);
    return response.data;
  },

  /**
   * Cancel a credit note
   */
  cancel: async (id, cancellation_reason) => {
    const response = await api.post(`/credit-notes/${id}/cancel`, { cancellation_reason });
    return response.data;
  },

  /**
   * Get credit note statistics
   */
  getStats: async (params = {}) => {
    const response = await api.get('/credit-notes/stats', { params });
    return response.data;
  }
};
