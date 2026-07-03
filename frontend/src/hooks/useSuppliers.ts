import { useQuery, useMutation, useQueryClient } from 'react-query';
import { supplierService } from '../services/api/supplierService';

export const useSuppliers = (params?: SupplierListParams) => {
  return useQuery(['suppliers', params], () => supplierService.getAll(params));
};

export const useSupplier = (id: number) => {
  return useQuery(['suppliers', id], () => supplierService.getById(id));
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation((data: Supplier) => supplierService.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries('suppliers');
    },
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (args: { id: number; data: Partial<Supplier> }) =>
      supplierService.update(args.id, args.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('suppliers');
      },
    }
  );
};

export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation((id: number) => supplierService.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('suppliers');
    },
  });
};