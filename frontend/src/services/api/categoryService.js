import api from './axios';

export const categoryService = {
  // Get all categories with pagination
  getAll: async (params = {}) => {
    const response = await api.get('/categories', { params });
    return response.data;
  },

  // Get categories with product count
  getWithProductCount: async () => {
    const response = await api.get('/categories/with-count');
    return response.data;
  },

  // Get category by ID
  getById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  // Create category
  create: async (categoryData) => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },

  // Update category
  update: async (id, categoryData) => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  // Delete category
  delete: async (id) => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};
