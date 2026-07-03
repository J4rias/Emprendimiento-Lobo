import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as brandService from '../services/api/brandService';

export const useBrands = (params?: Record<string, unknown>) => {
  return useQuery({ queryKey: ['brands', params], queryFn: () => brandService.getAllBrands(params) });
};

export const useBrand = (id: number) => {
  return useQuery({ queryKey: ['brands', id], queryFn: () => brandService.getBrandById(id) });
};

export const useActiveBrands = () => {
  return useQuery({ queryKey: ['brands', 'active'], queryFn: () => {
    if (brandService.getActiveBrands) {
      return brandService.getActiveBrands();
    } else {
      return brandService.getAllBrands({ is_active: true });
    }
  } });
};

export const useCreateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (data: Omit<brandService.Brand, 'id'>) => brandService.createBrand(data), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    }, });
};

export const useUpdateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (args: { id: number; data: Partial<Omit<brandService.Brand, 'id'>> }) =>
      brandService.updateBrand(args.id, args.data), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['brands'] });
      }, });
};

export const useDeleteBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (id: number) => brandService.deleteBrand(id), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    }, });
};