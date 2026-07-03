import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { preOrderService, PreOrderListParams, PreOrderResponse, PreOrderStatsResponse } from '../services/api/preOrderService';

export const usePreOrders = (params?: PreOrderListParams) => {
  return useQuery({ queryKey: ['pre-orders', params], queryFn: () => preOrderService.getAll(params) });
};

export const usePreOrder = (id: number) => {
  return useQuery({ queryKey: ['pre-orders', id], queryFn: () => preOrderService.getById(id) });
};

export const usePreOrderStats = () => {
  return useQuery({ queryKey: ['pre-orders', 'stats'], queryFn: preOrderService.getStats });
};

export const useApprovePreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (id: number) => preOrderService.approve(id), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['pre-orders'] });
      }, });
};

export const useRejectPreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (id: number) => preOrderService.reject(id), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['pre-orders'] });
      }, });
};

export const useConvertPreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: ({ id, data }: { id: number; data?: object }) => preOrderService.convert(id, data), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['pre-orders'] });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
      }, });
};