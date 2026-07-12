import api from './axios';

interface Pagination { total: number; page: number; limit: number; totalPages: number; }
interface Category { id: number; name: string; description?: string; product_count?: number; is_active: boolean; }
interface CategoryListResponse { data: Category[]; pagination: Pagination; }
interface CategoryResponse { message: string; data: Category; }

export const categoryService = {
  // Get all categories with pagination
  getAll: async (params = {}): Promise<CategoryListResponse> => {
    const response = await api.get('/categories', { params });
    return response.data;
  },

  // Get categories with product count (all, no pagination limit)
  getWithProductCount: async (): Promise<CategoryListResponse> => {
    const response = await api.get('/categories', { params: { limit: 1000 } });
    return response.data;
  },

  // Get category by ID
  getById: async (id: number): Promise<CategoryResponse> => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  // Create category
  create: async (categoryData: Category): Promise<CategoryResponse> => {
    const response = await api.post('/categories', categoryData);
    return response.data;
  },

  // Update category
  update: async (id: number, categoryData: Partial<Category>): Promise<CategoryResponse> => {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  },

  // Delete category
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  }
};