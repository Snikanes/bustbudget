import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Transaction, Transfer, ImportTransactionItem, ImportTransactionsResponse } from '@/types';
import { api } from '@/api/client';
import { accountKeys } from './useAccounts';
import { payeeKeys } from './usePayees';

export const transactionKeys = {
  all: ['transactions'] as const,
  byAccount: (accountId: string) => ['transactions', accountId] as const,
  detail: (id: string) => ['transactions', 'detail', id] as const,
};

export function useTransactions(accountId: string) {
  return useQuery({
    queryKey: transactionKeys.byAccount(accountId),
    queryFn: () =>
      api
        .get<{ transactions: Transaction[] }>(
          `/api/accounts/${accountId}/transactions`
        )
        .then((r) => r.transactions),
    enabled: !!accountId,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      ...data
    }: {
      accountId: string;
      date: string;
      amount: number;
      payee?: string;
      categoryId?: string;
      memo?: string;
      isCleared?: boolean;
    }) =>
      api
        .post<{ transaction: Transaction }>(
          `/api/accounts/${accountId}/transactions`,
          data
        )
        .then((r) => r.transaction),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.byAccount(variables.accountId),
      });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: payeeKeys.all });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      date?: string;
      amount?: number;
      payee?: string;
      categoryId?: string | null;
      memo?: string;
      isCleared?: boolean;
    }) =>
      api
        .put<{ transaction: Transaction }>(`/api/transactions/${id}`, data)
        .then((r) => r.transaction),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.byAccount(transaction.accountId),
      });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: payeeKeys.all });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      date: string;
      memo?: string;
      isCleared?: boolean;
    }) => api.post<{ transfer: Transfer }>('/api/transfers', data).then((r) => r.transfer),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.byAccount(variables.fromAccountId),
      });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.byAccount(variables.toAccountId),
      });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useImportTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      accountId,
      transactions,
    }: {
      accountId: string;
      transactions: ImportTransactionItem[];
    }) =>
      api
        .post<ImportTransactionsResponse>(`/api/accounts/${accountId}/import`, {
          transactions,
        }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.byAccount(variables.accountId),
      });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useReconcileAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<{ reconciledCount: number }>(`/api/accounts/${accountId}/reconcile`, {}),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.byAccount(accountId),
      });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useBulkToggleCleared() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      api.post<{ updatedCount: number }>(`/api/accounts/${accountId}/transactions/toggle-cleared`, {}),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({
        queryKey: transactionKeys.byAccount(accountId),
      });
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
