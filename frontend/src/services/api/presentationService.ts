import api from './axios';

export const presentationService = {
  getByProduct: async (productId: number) => {
    const response = await api.get(`/products/${productId}/presentations`);
    return response.data;
  },

  create: async (productId: number, data: Record<string, unknown>) => {
    const response = await api.post(`/products/${productId}/presentations`, data);
    return response.data;
  },

  update: async (presentationId: number, data: Record<string, unknown>) => {
    const response = await api.put(`/products/presentations/${presentationId}`, data);
    return response.data;
  },

  delete: async (presentationId: number) => {
    const response = await api.delete(`/products/presentations/${presentationId}`);
    return response.data;
  },

  setDefault: async (presentationId: number) => {
    const response = await api.put(`/products/presentations/${presentationId}/set-default`);
    return response.data;
  },
};
