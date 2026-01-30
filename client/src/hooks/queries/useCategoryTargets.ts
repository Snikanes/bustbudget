import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CategoryTarget } from '@/types';
import { api } from '@/api/client';
import { budgetKeys } from './useBudget';

export const targetKeys = {
  all: ['targets'] as const,
  byCategory: (categoryId: string) => ['targets', categoryId] as const,
};

async function fetchCategoryTarget(categoryId: string): Promise<CategoryTarget | null> {
  try {
    return await api.get<CategoryTarget>(`/api/categories/${categoryId}/target`);
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function createCategoryTarget(
  categoryId: string,
  data: {
    targetType: 'monthly' | 'yearly' | 'by_date';
    targetAmount: number;
    targetDate: string;
    recurrenceDay?: number;
  }
): Promise<CategoryTarget> {
  return api.post<CategoryTarget>(`/api/categories/${categoryId}/target`, data);
}

async function updateCategoryTarget(
  categoryId: string,
  data: {
    targetType?: 'monthly' | 'yearly' | 'by_date';
    targetAmount?: number;
    targetDate?: string;
    recurrenceDay?: number | null;
  }
): Promise<CategoryTarget> {
  return api.put<CategoryTarget>(`/api/categories/${categoryId}/target`, data);
}

async function deleteCategoryTarget(categoryId: string): Promise<void> {
  return api.delete<void>(`/api/categories/${categoryId}/target`);
}

export function useCategoryTarget(categoryId: string) {
  return useQuery({
    queryKey: targetKeys.byCategory(categoryId),
    queryFn: () => fetchCategoryTarget(categoryId),
  });
}

export function useCreateCategoryTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: {
        targetType: 'monthly' | 'yearly' | 'by_date';
        targetAmount: number;
        targetDate: string;
        recurrenceDay?: number;
      };
    }) => createCategoryTarget(categoryId, data),
    onSuccess: (_, { categoryId }) => {
      queryClient.invalidateQueries({ queryKey: targetKeys.byCategory(categoryId) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useUpdateCategoryTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      categoryId,
      data,
    }: {
      categoryId: string;
      data: {
        targetType?: 'monthly' | 'yearly' | 'by_date';
        targetAmount?: number;
        targetDate?: string;
        recurrenceDay?: number | null;
      };
    }) => updateCategoryTarget(categoryId, data),
    onSuccess: (_, { categoryId }) => {
      queryClient.invalidateQueries({ queryKey: targetKeys.byCategory(categoryId) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}

export function useDeleteCategoryTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => deleteCategoryTarget(categoryId),
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: targetKeys.byCategory(categoryId) });
      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
    },
  });
}
