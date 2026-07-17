import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { saleService } from '../services/api/saleService';
import type { SaleListParams } from '../services/api/saleService';
import type { Sale, SalePayment } from '../types';

export const useSales = (params?: SaleListParams) => {
  return useQuery({ queryKey: ['sales', params], queryFn: () => saleService.getSales(params) });
};

export const useSale = (id: number) => {
  return useQuery({ queryKey: ['sales', id], queryFn: () => saleService.getSaleById(id) });
};

export const useSalesStats = (params?: Record<string, string>) => {
  return useQuery({ queryKey: ['sales', 'stats', params], queryFn: () => saleService.getSalesStats(params) });
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: saleService.createSale, onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    }, });
};

export const useUpdateSale = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (data: { id: number; saleData: Partial<Sale> & Record<string, unknown> }) => saleService.updateSale(data.id, data.saleData), onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales', id] });
    }, });
};

export const useCancelSale = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (data: { id: number; reason: string }) => saleService.cancelSale(data.id, data.reason), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    }, });
};

export const useAddPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (data: { id: number; paymentData: SalePayment }) => saleService.addPayment(data.id, data.paymentData), onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['sales', id] });
    }, });
};