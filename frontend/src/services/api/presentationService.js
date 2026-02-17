import api from './axios';

export const presentationService = {
  getByProduct: async (productId) => {
    const response = await api.get(`/products/${productId}/presentations`);
    return response.data;
  },

  create: async (productId, data) => {
    const response = await api.post(`/products/${productId}/presentations`, data);
    return response.data;
  },

  update: async (presentationId, data) => {
    const response = await api.put(`/products/presentations/${presentationId}`, data);
    return response.data;
  },

  delete: async (presentationId) => {
    const response = await api.delete(`/products/presentations/${presentationId}`);
    return response.data;
  },

  setDefault: async (presentationId) => {
    const response = await api.put(`/products/presentations/${presentationId}/set-default`);
    return response.data;
  },
};
