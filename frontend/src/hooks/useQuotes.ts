import { useQuery, useMutation, useQueryClient } from 'react-query';
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
  return useQuery(['quotes', params], () => quoteService.getAll(params));
};

export const useQuote = (id: number) => {
  return useQuery(['quotes', id], () => quoteService.getById(id));
};

export const useCreateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation((data: Quote) => quoteService.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('quotes');
    },
  });
};

export const useUpdateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (args: { id: number; data: Quote }) => quoteService.update(args.id, args.data),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries('quotes');
        queryClient.invalidateQueries(['quotes', variables.id]);
      },
    }
  );
};

export const useDeleteQuote = () => {
  const queryClient = useQueryClient();

  return useMutation((id: number) => quoteService.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('quotes');
    },
  });
};

export const useConvertQuoteToSale = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (args: { id: number; data: any }) =>
      quoteService.convertToSale(args.id, args.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('quotes');
        queryClient.invalidateQueries('sales');
      },
    }
  );
};