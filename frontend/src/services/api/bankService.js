import api from './axios';

export const bankService = {
  getAll: async (currency) => {
    const params = currency ? { currency } : {};
    const response = await api.get('/banks', { params });
    return response.data;
  },
};
