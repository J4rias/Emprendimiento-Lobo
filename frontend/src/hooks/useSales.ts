import { useQuery, useMutation, useQueryClient } from 'react-query';
import { saleService } from '../services/api/saleService';

export const useSales = (params?: SaleListParams) => {
  return useQuery(['sales', params], () => saleService.getSales(params));
};

export const useSale = (id: number) => {
  return useQuery(['sales', id], () => saleService.getSaleById(id));
};

export const useSalesStats = (params?: Record<string, string>) => {
  return useQuery(['sales', 'stats', params], () => saleService.getSalesStats(params));
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();
  return useMutation(saleService.createSale, {
    onSuccess: () => {
      queryClient.invalidateQueries('sales');
    },
  });
};

export const useUpdateSale = () => {
  const queryClient = useQueryClient();
  return useMutation((data: { id: number; saleData: Partial<Sale> }) => saleService.updateSale(data.id, data.saleData), {
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries('sales');
      queryClient.invalidateQueries(['sales', id]);
    },
  });
};

export const useCancelSale = () => {
  const queryClient = useQueryClient();
  return useMutation((data: { id: number; reason: string }) => saleService.cancelSale(data.id, data.reason), {
    onSuccess: () => {
      queryClient.invalidateQueries('sales');
    },
  });
};

export const useAddPayment = () => {
  const queryClient = useQueryClient();
  return useMutation((data: { id: number; paymentData: SalePayment }) => saleService.addPayment(data.id, data.paymentData), {
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['sales', id]);
    },
  });
};