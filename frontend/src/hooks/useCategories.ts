import { useQuery, useMutation, useQueryClient } from 'react-query';
import { categoryService } from '../services/api/categoryService';

export const useCategories = (params?: Record<string, unknown>) => {
  return useQuery(['categories', params], () => categoryService.getAll(params));
};

export const useCategory = (id: number) => {
  return useQuery(['categories', id], () => categoryService.getById(id));
};

export const useCategoriesWithCount = () => {
  return useQuery(['categories', 'with-count'], categoryService.getWithProductCount);
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation(categoryService.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation((data: { id: number; categoryData: Partial<Category> }) => categoryService.update(data.id, data.categoryData), {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation((id: number) => categoryService.delete(id), {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });
};