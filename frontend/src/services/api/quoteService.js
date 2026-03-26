import api from './axios';

export const quoteService = {
  // Get all quotes with filters
  getAll: async (params = {}) => {
    const response = await api.get('/quotes', { params });
    return response.data;
  },

  // Get quote by ID
  getById: async (id) => {
    const response = await api.get(`/quotes/${id}`);
    return response.data;
  },

  // Create new quote
  create: async (data) => {
    const response = await api.post('/quotes', data);
    return response.data;
  },

  // Update quote
  update: async (id, data) => {
    const response = await api.put(`/quotes/${id}`, data);
    return response.data;
  },

  // Delete quote
  delete: async (id) => {
    const response = await api.delete(`/quotes/${id}`);
    return response.data;
  },

  // Convert quote to sale
  convertToSale: async (id, data) => {
    const response = await api.post(`/quotes/${id}/convert`, data);
    return response.data;
  },
};
