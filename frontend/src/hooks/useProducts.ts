import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/api/productService';
import type { ProductListParams } from '../services/api/productService';
import type { Product } from '../types';

export const useProducts = (params?: ProductListParams) => {
  return useQuery({ queryKey: ['products', params], queryFn: () => productService.getAll(params) });
};

export const useProduct = (id: number) => {
  return useQuery({ queryKey: ['products', id], queryFn: () => productService.getById(id) });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (data: Partial<Product>) => productService.create(data), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }, });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: ({ id, data }: { id: number; data: Partial<Product> }) =>
      productService.update(id, data), onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['products'] });
      }, });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn: (id: number) => productService.delete(id), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }, });
};