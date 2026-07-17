import api from './axios';

export const bankService = {
  getAll: async (currency?: string) => {
    const params = currency ? { currency } : {};
    const response = await api.get('/banks', { params });
    return response.data;
  },
};
