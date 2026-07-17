import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { brandService, Brand } from '../services/api/brandService';

export const useBrands = (params?: Record<string, unknown>) => {
  return useQuery({ queryKey: ['brands', params], queryFn: () => brandService.getAll(params) });
};

export const useBrand = (id: number) => {
  return useQuery({ queryKey: ['brands', id], queryFn: () => brandService.getById(id) });
};

export const useActiveBrands = () => {
  return useQuery({ queryKey: ['brands', 'active'], queryFn: () => brandService.getActive() });
};

export const useCreateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (data: Omit<Brand, 'id'>) => brandService.create(data), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    }, });
};

export const useUpdateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (args: { id: number; data: Partial<Omit<Brand, 'id'>> }) =>
      brandService.update(args.id, args.data), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['brands'] });
      }, });
};

export const useDeleteBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (id: number) => brandService.delete(id), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    }, });
};
