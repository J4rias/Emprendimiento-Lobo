import { useQuery, useMutation, useQueryClient } from 'react-query';
import * as brandService from '../services/api/brandService';

export const useBrands = (params?: Record<string, unknown>) => {
  return useQuery(['brands', params], () => brandService.getAllBrands(params));
};

export const useBrand = (id: number) => {
  return useQuery(['brands', id], () => brandService.getBrandById(id));
};

export const useActiveBrands = () => {
  return useQuery(['brands', 'active'], () => {
    if (brandService.getActiveBrands) {
      return brandService.getActiveBrands();
    } else {
      return brandService.getAllBrands({ is_active: true });
    }
  });
};

export const useCreateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation((data: Omit<brandService.Brand, 'id'>) => brandService.createBrand(data), {
    onSuccess: () => {
      queryClient.invalidateQueries(['brands']);
    },
  });
};

export const useUpdateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation(
    (args: { id: number; data: Partial<Omit<brandService.Brand, 'id'>> }) =>
      brandService.updateBrand(args.id, args.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['brands']);
      },
    }
  );
};

export const useDeleteBrand = () => {
  const queryClient = useQueryClient();

  return useMutation((id: number) => brandService.deleteBrand(id), {
    onSuccess: () => {
      queryClient.invalidateQueries(['brands']);
    },
  });
};