import api from './axios';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Customer {
  id: number;
  code: string;
  type: 'individual' | 'business';
  status: 'active' | 'inactive';
  firstName?: string;
  lastName?: string;
  businessName?: string;
  tradeName?: string;
  document_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit: number;
  credit_balance: number;
  discount_percentage: number;
  price_list_id?: number;
  created_at: string;
}

interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  sort_by?: string;
  sort_dir?: string;
}

interface CustomerListResponse {
  data: Customer[];
  pagination: Pagination;
}

interface CustomerResponse {
  data: Customer;
}

export const customerService = {
  // Get all customers with filters
  getAll: async (params: CustomerListParams = {}): Promise<CustomerListResponse> => {
    const response = await api.get('/customers', { params });
    return response.data;
  },

  // Get active customers (for dropdowns)
  getActive: async (): Promise<Customer[]> => {
    const response = await api.get('/customers/active');
    return response.data;
  },

  // Get customer by ID
  getById: async (id: number): Promise<CustomerResponse> => {
    const response = await api.get(`/customers/${id}`);
    return response.data;
  },

  // Create new customer
  create: async (data: Customer): Promise<CustomerResponse> => {
    const response = await api.post('/customers', data);
    return response.data;
  },

  // Update customer
  update: async (id: number, data: Partial<Customer>): Promise<CustomerResponse> => {
    const response = await api.put(`/customers/${id}`, data);
    return response.data;
  },

  // Delete customer (soft delete)
  delete: async (id: number): Promise<void> => {
    const response = await api.delete(`/customers/${id}`);
    return response.data;
  },

  // Get credit summary
  getCreditSummary: async (id: number): Promise<any> => {
    const response = await api.get(`/customers/${id}/credit`);
    return response.data;
  },

  validateCredit: async (id: number, amount: number): Promise<any> => {
    const response = await api.get(`/customers/${id}/credit/validate`, {
      params: { amount }
    });
    return response.data;
  },

  // Get customer statistics
  getStats: async (id: number): Promise<any> => {
    const response = await api.get(`/customers/${id}/stats`);
    return response.data;
  },

  // Get customer statement (ledger)
  getStatement: async (id: number): Promise<any> => {
    const response = await api.get(`/customers/${id}/statement`);
    return response.data;
  },

  // Get customer credit balance (saldo a favor)
  getCreditBalance: async (id: number): Promise<any> => {
    const response = await api.get(`/customers/${id}/credit-balance`);
    return response.data;
  }
};