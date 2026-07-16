import api from './axios';

export const userService = {
    // Get all users
    getAll: async (params = {}) => {
        const response = await api.get('/users', { params });
        return response.data;
    },

    // Get active users (mapped for dropdowns)
    getActive: async () => {
        const response = await api.get('/users');
        const users = response.data?.data || [];
        // Mapear firstname + lastname a "name" para la UI
        return {
            data: users
                .filter(u => u.is_active !== false)
                .map(u => ({
                    ...u,
                    name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username
                }))
        };
    },

    // Get user by ID
    getById: async (id) => {
        const response = await api.get(`/users/${id}`);
        return response.data;
    },

    // Create new user
    create: async (data) => {
        const response = await api.post('/users', data);
        return response.data;
    },

    // Update user
    update: async (id, data) => {
        const response = await api.put(`/users/${id}`, data);
        return response.data;
    },

    // Delete user
    delete: async (id) => {
        const response = await api.delete(`/users/${id}`);
        return response.data;
    },

    // Get all roles
    getRoles: async () => {
        const response = await api.get('/roles');
        return response.data;
    }
};
