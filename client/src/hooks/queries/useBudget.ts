import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BudgetMonth, MonthlyBudget } from '@/types';
import { api } from '@/api/client';

export const budgetKeys = {
  all: ['budget'] as const,
  month: (month: string) => ['budget', month] as const,
};

export function useBudget(month: string) {
  return useQuery({
    queryKey: budgetKeys.month(month),
    queryFn: () => api.get<BudgetMonth>(`/api/budgets/${month}`),
  });
}

export function useUpdateBudgetEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      month,
      categoryId,
      assigned,
    }: {
      month: string;
      categoryId: string;
      assigned: number;
    }) =>
      api
        .put<{ monthlyBudget: MonthlyBudget }>(
          `/api/budgets/${month}/categories/${categoryId}`,
          { assigned }
        )
        .then((r) => r.monthlyBudget),

    onMutate: async ({ month, categoryId, assigned }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: budgetKeys.month(month) });

      // Snapshot previous value
      const previous = queryClient.getQueryData<BudgetMonth>(
        budgetKeys.month(month)
      );

      // Optimistically update
      if (previous) {
        const updatedBudget = { ...previous };

        // Find and update the category in groups
        for (const group of updatedBudget.groups) {
          const category = group.categories.find(c => c.categoryId === categoryId);
          if (category) {
            const diff = assigned - category.assigned;
            category.assigned = assigned;
            category.available = category.available + diff;
            updatedBudget.availableToAssign -= diff;
            updatedBudget.totalAssigned += diff;
            break;
          }
        }

        // Check ungrouped categories
        const ungroupedCategory = updatedBudget.ungroupedCategories.find(
          c => c.categoryId === categoryId
        );
        if (ungroupedCategory) {
          const diff = assigned - ungroupedCategory.assigned;
          ungroupedCategory.assigned = assigned;
          ungroupedCategory.available = ungroupedCategory.available + diff;
          updatedBudget.availableToAssign -= diff;
          updatedBudget.totalAssigned += diff;
        }

        queryClient.setQueryData(budgetKeys.month(month), updatedBudget);
      }

      return { previous };
    },

    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          budgetKeys.month(variables.month),
          context.previous
        );
      }
    },

    onSettled: (_data, _err, variables) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: budgetKeys.month(variables.month),
      });
    },
  });
}
