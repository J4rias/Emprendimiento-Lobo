import api from './axios';

/**
 * POS Reservation API Service
 * Handles communication with backend for product reservations
 */
export const posReservationService = {
  /**
   * Reserve or update a product reservation for a POS tab
   * POST /api/pos/reserve
   */
  reserve: async (data) => {
    const response = await api.post('/pos/reserve', data);
    return response.data;
  },

  /**
   * Release/reduce a product reservation
   * PATCH /api/pos/reserve
   */
  releaseItem: async (data) => {
    const response = await api.patch('/pos/reserve', data);
    return response.data;
  },

  /**
   * Release all reservations for a specific tab
   * DELETE /api/pos/tab
   */
  releaseTab: async (data) => {
    const response = await api.delete('/pos/tab', { data });
    return response.data;
  },

  /**
   * Get all current reservations (for client initialization)
   * GET /api/pos/reservations
   */
  getAll: async () => {
    const response = await api.get('/pos/reservations');
    return response.data;
  },

  /**
   * Cleanup expired reservations (admin only)
   * POST /api/pos/cleanup-expired
   */
  cleanupExpired: async () => {
    const response = await api.post('/pos/cleanup-expired');
    return response.data;
  }
};
