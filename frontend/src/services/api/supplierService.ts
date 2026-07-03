import api from './axios';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Supplier {
  id: number;
  name: string;
  code: string;
  rif?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
}

interface SupplierListParams {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

interface SupplierListResponse {
  data: Supplier[];
  pagination: Pagination;
}

interface SupplierResponse {
  message: string;
  data: Supplier;
}

export const supplierService = {
  // Get all suppliers
  getAll: async (params: SupplierListParams = {}): Promise<SupplierListResponse> => {
    const response = await api.get('/suppliers', { params });
    return response.data;
  },

  // Get active suppliers (for dropdowns)
  getActive: async (): Promise<Supplier[]> => {
    const response = await api.get('/suppliers', {
      params: { is_active: true, limit: 1000 }
    });
    return response.data;
  },

  // Get supplier by ID
  getById: async (id: number): Promise<Supplier> => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  // Create supplier
  create: async (data: Supplier): Promise<SupplierResponse> => {
    const response = await api.post('/suppliers', data);
    return response.data;
  },

  // Update supplier
  update: async (id: number, data: Partial<Supplier>): Promise<SupplierResponse> => {
    const response = await api.put(`/suppliers/${id}`, data);
    return response.data;
  },

  // Delete supplier
  delete: async (id: number): Promise<SupplierResponse> => {
    const response = await api.delete(`/suppliers/${id}`);
    return response.data;
  },

  // Get supplier statement (legacy unified ledger)
  getStatement: async (id: number): Promise<any> => {
    const response = await api.get(`/suppliers/${id}/statement`);
    return response.data;
  },

  // Get supplier ledger grouped by category (USD/DIVISAS/COP)
  getLedger: async (id: number): Promise<any> => {
    const response = await api.get(`/suppliers/${id}/ledger`);
    return response.data;
  },

  // Get resumen de proveedores (all suppliers with balances by category)
  getResumen: async (): Promise<any> => {
    const response = await api.get('/suppliers/resumen');
    return response.data;
  }
};