import api from './axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const exchangeRateService = {
    getLatest: async () => {
        const response = await api.get('/exchange-rates/latest');
        return response.data;
    },

    convert: async (amount, from = 'USD', to = 'VES') => {
        const response = await api.get('/exchange-rates/convert', {
            params: { amount, from_currency: from, to_currency: to }
        });
        return response.data;
    },

    getAll: async (params = {}) => {
        const response = await api.get('/exchange-rates', { params });
        return response.data;
    }
};
