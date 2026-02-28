import api from './axios';

export const priceListService = {
    getAll: async (params = {}) => {
        const response = await api.get('/price-lists', { params });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/price-lists/${id}`);
        return response.data;
    },

    create: async (data) => {
        const response = await api.post('/price-lists', data);
        return response.data;
    },

    update: async (id, data) => {
        const response = await api.put(`/price-lists/${id}`, data);
        return response.data;
    },

    duplicate: async (id, name) => {
        const response = await api.post(`/price-lists/${id}/duplicate`, { name });
        return response.data;
    },

    getActive: async () => {
        const response = await api.get('/price-lists/active');
        return response.data;
    },

    getProductsWithStock: async () => {
        const response = await api.get('/price-lists/products-with-stock');
        return response.data;
    },

    exportCSV: async (id) => {
        const response = await api.get(`/price-lists/${id}/export/csv`, {
            responseType: 'blob'
        });
        const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lista-precios-${id}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    },

    delete: async (id) => {
        const response = await api.delete(`/price-lists/${id}`);
        return response.data;
    }
};
