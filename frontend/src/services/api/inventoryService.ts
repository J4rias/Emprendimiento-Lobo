import api from './axios';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface InventoryItem {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  min_stock?: number;
  product?: { id: number; name: string; sku: string; presentations?: unknown[] };
  warehouse?: { id: number; name: string };
}

interface InventoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  warehouse_id?: number;
  product_id?: number;
}

interface InventoryListResponse {
  data: InventoryItem[];
  pagination: Pagination;
}

interface AdjustData {
  product_id: number;
  warehouse_id: number;
  quantity: number;
  reason: string;
  type: 'entrada' | 'ajuste';
}

export const inventoryService = {
  getByWarehouse: async (warehouseId: number, params?: InventoryListParams): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params: { ...params, warehouse_id: warehouseId } });
    return response.data;
  },

  getAll: async (params?: InventoryListParams): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  getById: async (id: number): Promise<InventoryItem> => {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },

  getByProduct: async (productId: number): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params: { product_id: productId } });
    return response.data;
  },

  getLowStock: async (params?: Record<string, unknown>): Promise<any> => {
    const response = await api.get('/inventory/alerts/low-stock', { params });
    return response.data;
  },

  getExpiringProducts: async (params?: Record<string, unknown>): Promise<any> => {
    const response = await api.get('/inventory/alerts/expiring', { params });
    return response.data;
  },

  getValuation: async (params?: Record<string, unknown>): Promise<any> => {
    const response = await api.get('/inventory/valuation', { params });
    return response.data;
  },

  adjustInventory: async (data: AdjustData): Promise<any> => {
    const response = await api.post('/inventory/adjust', data);
    return response.data;
  },

  getMovements: async (params?: Record<string, unknown>): Promise<any> => {
    const response = await api.get('/inventory/movements', { params });
    return response.data;
  },
};