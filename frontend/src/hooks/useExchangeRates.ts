import { useQuery, useMutation, useQueryClient } from 'react-query';
import { exchangeRateService } from '../services/api/exchangeRateService';

interface ExchangeRateParams { page?: number; limit?: number; pair?: string; is_active?: boolean; date_from?: string; date_to?: string; }

export const useExchangeRates = (params?: ExchangeRateParams) => {
    return useQuery(['exchange-rates', params], () => exchangeRateService.getAll(params));
};

export const useLatestExchangeRate = () => {
    return useQuery(['exchange-rates', 'latest'], exchangeRateService.getLatest, { staleTime: 5 * 60 * 1000 });
};

export const useCreateExchangeRate = () => {
    const queryClient = useQueryClient();
    return useMutation(exchangeRateService.create, {
        onSuccess: () => {
            queryClient.invalidateQueries('exchange-rates');
        }
    });
};

export const useDeleteExchangeRate = () => {
    const queryClient = useQueryClient();
    return useMutation((id: number) => exchangeRateService.deleteRate(id), {
        onSuccess: () => {
            queryClient.invalidateQueries('exchange-rates');
        }
    });
};