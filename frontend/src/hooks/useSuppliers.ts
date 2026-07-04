import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supplierService } from '../services/api/supplierService';

export const useSuppliers = (params?: SupplierListParams) => {
  return useQuery({ queryKey: ['suppliers', params], queryFn: () => supplierService.getAll(params) });
};

export const useSupplier = (id: number) => {
  return useQuery({ queryKey: ['suppliers', id], queryFn: () => supplierService.getById(id) });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (data: Supplier) => supplierService.create(data), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    }, });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (args: { id: number; data: Partial<Supplier> }) =>
      supplierService.update(args.id, args.data), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      }, });
};

export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (id: number) => supplierService.delete(id), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    }, });
};