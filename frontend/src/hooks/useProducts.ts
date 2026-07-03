import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productService } from '../services/api/productService';

export const useProducts = (params?: ProductListParams) => {
  return useQuery(['products', params], () => productService.getAll(params));
};

export const useProduct = (id: number) => {
  return useQuery(['products', id], () => productService.getById(id));
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation((data: Partial<Product>) => productService.create(data), {
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation(
    ({ id, data }: { id: number; data: Partial<Product> }) =>
      productService.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['products']);
      },
    }
  );
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation((id: number) => productService.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries(['products']);
    },
  });
};