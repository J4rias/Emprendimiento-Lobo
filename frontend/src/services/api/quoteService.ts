import api from './axios';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface QuoteItem {
  product_id: number;
  presentation_id: number;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: number;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  customer_id?: number;
  total: number;
  notes?: string;
  valid_until?: string;
  created_at: string;
  items?: QuoteItem[];
}

interface QuoteListParams {
  page?: number;
  limit?: number;
  status?: string;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
}

interface QuoteListResponse {
  data: Quote[];
  pagination: Pagination;
}

interface QuoteResponse {
  message: string;
  data: Quote;
}

export const quoteService = {
  // Get all quotes with filters
  getAll: async (params: QuoteListParams = {}): Promise<QuoteListResponse> => {
    const response = await api.get('/quotes', { params });
    return response.data;
  },

  // Get quote by ID
  getById: async (id: number): Promise<QuoteResponse> => {
    const response = await api.get(`/quotes/${id}`);
    return response.data;
  },

  // Create new quote
  create: async (data: Quote): Promise<QuoteResponse> => {
    const response = await api.post('/quotes', data);
    return response.data;
  },

  // Update quote
  update: async (id: number, data: Quote): Promise<QuoteResponse> => {
    const response = await api.put(`/quotes/${id}`, data);
    return response.data;
  },

  // Delete quote
  delete: async (id: number): Promise<any> => {
    const response = await api.delete(`/quotes/${id}`);
    return response.data;
  },

  // Convert quote to sale
  convertToSale: async (id: number, data: any): Promise<any> => {
    const response = await api.post(`/quotes/${id}/convert`, data);
    return response.data;
  },
};