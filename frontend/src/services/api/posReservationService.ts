import api from './axios';

interface ReserveData {
  tab_id: string;
  product_id: number;
  quantity: number;
  user_id?: number;
}

interface ReleaseData {
  tab_id: string;
  product_id: number;
  quantity?: number;
}

export const posReservationService = {
  reserve: async (data: ReserveData) => {
    const response = await api.post('/pos/reserve', data);
    return response.data;
  },

  releaseItem: async (data: ReleaseData) => {
    const response = await api.patch('/pos/reserve', data);
    return response.data;
  },

  releaseTab: async (data: { tab_id: string; user_id?: number }) => {
    const response = await api.delete('/pos/tab', { data });
    return response.data;
  },

  getAll: async () => {
    const response = await api.get('/pos/reservations');
    return response.data;
  },

  cleanupExpired: async () => {
    const response = await api.post('/pos/cleanup-expired');
    return response.data;
  }
};
