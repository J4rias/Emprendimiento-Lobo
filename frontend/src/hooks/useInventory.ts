import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '../services/api/inventoryService';
import type { InventoryListParams, AdjustData } from '../services/api/inventoryService';

export const useInventoryByWarehouse = (warehouseId: number, params?: InventoryListParams) => {
  return useQuery({ queryKey: ['inventory', 'warehouse', warehouseId, params], queryFn: () => inventoryService.getByWarehouse(warehouseId, params) });
};

export const useInventoryItem = (id: number) => {
  return useQuery({ queryKey: ['inventory', id], queryFn: () => inventoryService.getById(id) });
};

export const useInventoryByProduct = (productId: number) => {
  return useQuery({ queryKey: ['inventory', 'product', productId], queryFn: () => inventoryService.getByProduct(productId) });
};

export const useLowStock = (params?: Record<string, unknown>) => {
  return useQuery({ queryKey: ['inventory', 'low-stock', params], queryFn: () => inventoryService.getLowStock(params) });
};

export const useInventoryMovements = (params?: Record<string, unknown>) => {
  return useQuery({ queryKey: ['inventory', 'movements', params], queryFn: () => inventoryService.getMovements(params) });
};

export const useAdjustInventory = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (data: AdjustData) => inventoryService.adjustInventory(data), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }, });
};