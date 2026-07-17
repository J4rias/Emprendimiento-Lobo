import api from './axios';

interface UserRow {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export const userService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getActive: async () => {
    const response = await api.get('/users');
    const users: UserRow[] = response.data?.data || [];
    return {
      data: users
        .filter((u) => u.is_active !== false)
        .map((u) => ({
          ...u,
          name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username
        }))
    };
  },

  getById: async (id: number) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/users', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  getRoles: async () => {
    const response = await api.get('/roles');
    return response.data;
  }
};
