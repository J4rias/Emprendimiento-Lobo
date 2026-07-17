import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quoteService } from '../services/api/quoteService';
import type { Quote } from '../types';
import type { QuoteListParams } from '../services/api/quoteService';

export const useQuotes = (params?: QuoteListParams) => {
  return useQuery({ queryKey: ['quotes', params], queryFn: () => quoteService.getAll(params) });
};

export const useQuote = (id: number) => {
  return useQuery({ queryKey: ['quotes', id], queryFn: () => quoteService.getById(id) });
};

export const useCreateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (data: Partial<Quote>) => quoteService.create(data), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }, });
};

export const useUpdateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (args: { id: number; data: Partial<Quote> }) => quoteService.update(args.id, args.data), onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['quotes', variables.id] });
      }, });
};

export const useDeleteQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (id: number) => quoteService.delete(id), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }, });
};

export const useConvertQuoteToSale = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (args: { id: number; data: unknown }) =>
      quoteService.convertToSale(args.id, args.data), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
      }, });
};
