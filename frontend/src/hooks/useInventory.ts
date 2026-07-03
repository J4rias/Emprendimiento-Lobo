import { useQuery, useMutation, useQueryClient } from 'react-query';
import { inventoryService } from '../services/api/inventoryService';

export const useInventoryByWarehouse = (warehouseId: number, params?: InventoryListParams) => {
  return useQuery(['inventory', 'warehouse', warehouseId, params], () => inventoryService.getByWarehouse(warehouseId, params));
};

export const useInventoryItem = (id: number) => {
  return useQuery(['inventory', id], () => inventoryService.getById(id));
};

export const useInventoryByProduct = (productId: number) => {
  return useQuery(['inventory', 'product', productId], () => inventoryService.getByProduct(productId));
};

export const useLowStock = (params?: Record<string, unknown>) => {
  return useQuery(['inventory', 'low-stock', params], () => inventoryService.getLowStock(params));
};

export const useInventoryMovements = (params?: Record<string, unknown>) => {
  return useQuery(['inventory', 'movements', params], () => inventoryService.getMovements(params));
};

export const useAdjustInventory = () => {
  const queryClient = useQueryClient();

  return useMutation((data: AdjustData) => inventoryService.adjustInventory(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('inventory');
    },
  });
};