import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoryService } from '../services/api/categoryService';

export const useCategories = (params?: Record<string, unknown>) => {
  return useQuery({ queryKey: ['categories', params], queryFn: () => categoryService.getAll(params) });
};

export const useCategory = (id: number) => {
  return useQuery({ queryKey: ['categories', id], queryFn: () => categoryService.getById(id) });
};

export const useCategoriesWithCount = () => {
  return useQuery({ queryKey: ['categories', 'with-count'], queryFn: categoryService.getWithProductCount });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: categoryService.create, onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }, });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (data: { id: number; categoryData: Partial<Category> }) => categoryService.update(data.id, data.categoryData), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }, });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: number) => categoryService.delete(id), onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }, });
};