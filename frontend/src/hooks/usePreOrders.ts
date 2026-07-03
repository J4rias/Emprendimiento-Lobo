import { useQuery, useMutation, useQueryClient } from 'react-query';
import { preOrderService, PreOrderListParams, PreOrderResponse, PreOrderStatsResponse } from '../services/api/preOrderService';

export const usePreOrders = (params?: PreOrderListParams) => {
  return useQuery(['pre-orders', params], () => preOrderService.getAll(params));
};

export const usePreOrder = (id: number) => {
  return useQuery(['pre-orders', id], () => preOrderService.getById(id));
};

export const usePreOrderStats = () => {
  return useQuery(['pre-orders', 'stats'], preOrderService.getStats);
};

export const useApprovePreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (id: number) => preOrderService.approve(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pre-orders']);
      },
    }
  );
};

export const useRejectPreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (id: number) => preOrderService.reject(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pre-orders']);
      },
    }
  );
};

export const useConvertPreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ id, data }: { id: number; data?: object }) => preOrderService.convert(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['pre-orders']);
        queryClient.invalidateQueries(['sales']);
      },
    }
  );
};