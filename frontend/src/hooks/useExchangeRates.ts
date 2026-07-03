import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { exchangeRateService } from '../services/api/exchangeRateService';

interface ExchangeRateParams { page?: number; limit?: number; pair?: string; is_active?: boolean; date_from?: string; date_to?: string; }

export const useExchangeRates = (params?: ExchangeRateParams) => {
    return useQuery({ queryKey: ['exchange-rates', params], queryFn: () => exchangeRateService.getAll(params) });
};

export const useLatestExchangeRate = () => {
    return useQuery({ queryKey: ['exchange-rates', 'latest'], queryFn: exchangeRateService.getLatest, staleTime: 5 * 60 * 1000 });
};

export const useCreateExchangeRate = () => {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: exchangeRateService.create, onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
        } });
};

export const useDeleteExchangeRate = () => {
    const queryClient = useQueryClient();
    return useMutation({ mutationFn: (id: number) => exchangeRateService.deleteRate(id), onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exchange-rates'] });
        } });
};