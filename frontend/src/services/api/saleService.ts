import api from './axios';

export const saleService = {
  createSale: async (saleData: Sale) => {
    const response = await api.post('/sales', saleData);
    return response.data;
  },

  getSales: async (params: SaleListParams = {}) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  getSaleById: async (id: number) => {
    const response = await api.get(`/sales/${id}`);
    return response.data;
  },

  getBySaleNumber: async (saleNumber: string) => {
    const response = await api.get('/sales', { params: { sale_number: saleNumber } });
    return response.data;
  },

  updateSale: async (id: number, data: Partial<Sale>) => {
    const response = await api.patch(`/sales/${id}`, data);
    return response.data;
  },

  cancelSale: async (id: number, reason: string) => {
    const response = await api.post(`/sales/${id}/cancel`, { reason });
    return response.data;
  },

  addPayment: async (id: number, paymentData: SalePayment) => {
    const response = await api.post(`/sales/${id}/payments`, paymentData);
    return response.data;
  },

  getSalesStats: async (params: Record<string, string> = {}) => {
    const response = await api.get('/sales/stats', { params });
    return response.data;
  },

  getProductSales: async (params: Record<string, string> = {}) => {
    const response = await api.get('/sales/product-sales', { params });
    return response.data;
  },

  getDailyClosure: async (params: Record<string, string> = {}) => {
    const response = await api.get('/sales/daily-closure', { params });
    return response.data;
  },

  validateCreditPin: async (pin: string) => {
    const response = await api.post('/sales/validate-credit-pin', { pin });
    return response.data;
  }
};

interface Pagination { total: number; page: number; limit: number; totalPages: number; }
interface SalePayment { id: number; method: string; amount: number; currency: string; }
interface SaleDetail { id: number; product_id: number; quantity: number; unit_price: number; total: number; }
interface Sale {
  id: number;
  sale_number: string;
  sale_type: 'cash' | 'credit' | 'mixed';
  status: 'completed' | 'pending' | 'cancelled';
  total: number;
  exchange_rate: number;
  notes?: string;
  sale_date: string;
  customer_id?: number;
  warehouse_id: number;
  payments?: SalePayment[];
  details?: SaleDetail[];
}
interface SaleListParams { page?: number; limit?: number; search?: string; status?: string; sale_type?: string; customer_id?: number; warehouse_id?: number; date_from?: string; date_to?: string; }
interface SaleListResponse { data: Sale[]; pagination: Pagination; }
interface SaleResponse { message: string; data: Sale; }
interface SaleStatsResponse { data: { totalSales: number; totalRevenue: number; totalRevenueCOP: number; totalCost: number; grossProfit: number; grossMarginPct: number; [key: string]: unknown; }; }