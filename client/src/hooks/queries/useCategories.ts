import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Category, CategoryGroup } from '@/types';
import { api } from '@/api/client';
import { budgetKeys } from './useBudget';

export const categoryKeys = {
  all: ['categories'] as const,
  groups: ['category-groups'] as const,
  detail: (id: string) => ['categories', id] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.all,
    queryFn: () =>
      api.get<{ categories: Category[] }>('/api/categories').then((r) => r.categories),
  });
}

export function useCategoryGroups() {
  return useQuery({
    queryKey: categoryKeys.groups,
    queryFn: () =>
      api
        .get<{ categoryGroups: CategoryGroup[] }>('/api/category-groups')
        .then((r) => r.categoryGroups),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; groupId?: string }) =>
      api.post<{ category: Category }>('/api/categories', data).then((r) => r.category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups });
    },
  });
}

export function useCreateCategoryGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string }) =>
      api
        .post<{ categoryGroup: CategoryGroup }>('/api/category-groups', data)
        .then((r) => r.categoryGroup),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; groupId?: string | null }) =>
      api.put<{ category: Category }>(`/api/categories/${id}`, data).then((r) => r.category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups });
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { groupId: string | null; orderedIds: string[] }) =>
      api.post('/api/categories/reorder', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
      queryClient.invalidateQueries({ queryKey: categoryKeys.groups });
      // Also invalidate budget queries to reflect new order
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
