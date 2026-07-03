import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quoteService } from '../services/api/quoteService';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface QuoteItem {
  product_id: number;
  presentation_id: number;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: number;
  quote_number: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
  customer_id?: number;
  total: number;
  notes?: string;
  valid_until?: string;
  created_at: string;
  items?: QuoteItem[];
}

interface QuoteListParams {
  page?: number;
  limit?: number;
  status?: string;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
}

export const useQuotes = (params?: QuoteListParams) => {
  return useQuery({ queryKey: ['quotes', params], queryFn: () => quoteService.getAll(params) });
};

export const useQuote = (id: number) => {
  return useQuery({ queryKey: ['quotes', id], queryFn: () => quoteService.getById(id) });
};

export const useCreateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (data: Quote) => quoteService.create(data), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    }, });
};

export const useUpdateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (args: { id: number; data: Quote }) => quoteService.update(args.id, args.data), onSuccess: (data, variables) => {
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

  return useMutation({ mutationFn: (args: { id: number; data: any }) =>
      quoteService.convertToSale(args.id, args.data), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
        queryClient.invalidateQueries({ queryKey: ['sales'] });
      }, });
};