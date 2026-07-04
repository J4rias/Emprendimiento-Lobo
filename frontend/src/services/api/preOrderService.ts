import api from './axios';

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PreOrder {
  id: number;
  code: string;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  customer_id?: number;
  notes?: string;
  created_at: string;
  items?: unknown[];
}

export interface PreOrderListParams {
  page?: number;
  limit?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}

export interface PreOrderListResponse {
  data: PreOrder[];
  pagination: Pagination;
}

export interface PreOrderResponse {
  data: PreOrder;
}

export interface PreOrderStatsResponse {
  data: {
    pending: number;
    approved: number;
    today: number;
  };
}

export const preOrderService = {
  getAll: async (params: PreOrderListParams = {}): Promise<PreOrderListResponse> => {
    const response = await api.get('/pre-orders', { params });
    return response.data;
  },

  getById: async (id: number): Promise<PreOrderResponse> => {
    const response = await api.get(`/pre-orders/${id}`);
    return response.data;
  },

  getStats: async (): Promise<PreOrderStatsResponse> => {
    const response = await api.get('/pre-orders/stats');
    return response.data;
  },

  approve: async (id: number): Promise<PreOrderResponse> => {
    const response = await api.post(`/pre-orders/${id}/approve`);
    return response.data;
  },

  reject: async (id: number): Promise<PreOrderResponse> => {
    const response = await api.post(`/pre-orders/${id}/reject`);
    return response.data;
  },

  convert: async (id: number, data?: object): Promise<PreOrderResponse> => {
    const response = await api.post(`/pre-orders/${id}/convert`, data);
    return response.data;
  },
};