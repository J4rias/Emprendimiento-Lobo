import api from './axios';

export const priceListService = {
  getAll: async (params: Record<string, unknown> = {}) => {
    const response = await api.get('/price-lists', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/price-lists/${id}`);
    return response.data;
  },

  create: async (data: Record<string, unknown>) => {
    const response = await api.post('/price-lists', data);
    return response.data;
  },

  update: async (id: number, data: Record<string, unknown>) => {
    const response = await api.put(`/price-lists/${id}`, data);
    return response.data;
  },

  duplicate: async (id: number, name: string) => {
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

  exportCSV: async (id: number) => {
    const response = await api.get(`/price-lists/${id}/export/csv`, {
      responseType: 'blob'
    });
    const blob = new Blob([response.data as BlobPart], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lista-precios-${id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  delete: async (id: number) => {
    const response = await api.delete(`/price-lists/${id}`);
    return response.data;
  },

  updateDetail: async (listId: number, data: Record<string, unknown>) => {
    const response = await api.patch(`/price-lists/${listId}/detail`, data);
    return response.data;
  }
};
