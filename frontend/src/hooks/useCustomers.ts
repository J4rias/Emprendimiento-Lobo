import { useQuery, useMutation, useQueryClient } from 'react-query';
import { customerService } from '../services/api/customerService';

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Customer {
  id: number;
  code: string;
  type: 'individual' | 'business';
  status: 'active' | 'inactive';
  firstName?: string;
  lastName?: string;
  businessName?: string;
  tradeName?: string;
  document_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  credit_limit: number;
  credit_balance: number;
  discount_percentage: number;
  price_list_id?: number;
  created_at: string;
}

interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  sort_by?: string;
  sort_dir?: string;
}

export const useCustomers = (params?: CustomerListParams) => {
  return useQuery(['customers', params], () => customerService.getAll(params));
};

export const useCustomer = (id: number) => {
  return useQuery(['customers', id], () => customerService.getById(id));
};

export const useActiveCustomers = () => {
  return useQuery(['customers', 'active'], customerService.getActive);
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation(customerService.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('customers');
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation((data: { id: number; customerData: Partial<Customer> }) =>
    customerService.update(data.id, data.customerData), {
    onSuccess: () => {
      queryClient.invalidateQueries('customers');
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation((id: number) => customerService.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('customers');
    },
  });
};