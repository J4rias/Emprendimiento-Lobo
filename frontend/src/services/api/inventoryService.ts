import api from './axios';
import type { Pagination } from '../../types';

export interface InventoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  warehouse_id?: number;
  product_id?: number;
  category_id?: number;
}

// Filtros de alcance compartidos por los KPIs (valuación, stock bajo, por vencer)
export interface InventoryScopeParams {
  warehouse_id?: number;
  category_id?: number;
  days?: number;
  limit?: number;
}

interface InventoryListResponse {
  data: unknown[];
  pagination: Pagination;
}

export interface AdjustData {
  product_id: number;
  warehouse_id: number;
  type: 'add' | 'remove';
  presentation_id?: number;
  package_quantity?: number;
  loose_units?: number;
  reason?: string;
  document_number?: string;
  batch_id?: number;
}

export const inventoryService = {
  getByWarehouse: async (warehouseId: number | string, params?: InventoryListParams): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params: { ...params, warehouse_id: warehouseId } });
    return response.data;
  },

  getAll: async (params?: InventoryListParams): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/inventory/${id}`);
    return response.data;
  },

  getByProduct: async (productId: number): Promise<InventoryListResponse> => {
    const response = await api.get('/inventory', { params: { product_id: productId } });
    return response.data;
  },

  getLowStock: async (params?: InventoryScopeParams) => {
    const response = await api.get('/inventory/alerts/low-stock', { params });
    return response.data;
  },

  getExpiringProducts: async (params?: InventoryScopeParams) => {
    const response = await api.get('/inventory/alerts/expiring', { params });
    return response.data;
  },

  getValuation: async (params?: InventoryScopeParams) => {
    const response = await api.get('/inventory/valuation', { params });
    return response.data;
  },

  adjustInventory: async (data: AdjustData) => {
    const response = await api.post('/inventory/adjust', data);
    return response.data;
  },

  getMovements: async (params?: Record<string, unknown>) => {
    const response = await api.get('/inventory/movements', { params });
    return response.data;
  },
};
