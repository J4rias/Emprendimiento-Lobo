import api from './axios';

interface ReserveData {
  session_id: string;
  tab_id: string | null;
  user_id?: number;
  product_id: number;
  presentation_id: number;
  units_requested: number;
  quantity?: number;
}

interface ReleaseData {
  session_id: string;
  tab_id: string | null;
  presentation_id: number;
  units_to_release: number;
  product_id?: number;
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

  releaseTab: async (data: { session_id: string; tab_id: string | null; user_id?: number }) => {
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
