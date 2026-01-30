import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Account } from '@/types';
import { api } from '@/api/client';

export const accountKeys = {
  all: ['accounts'] as const,
  detail: (id: string) => ['accounts', id] as const,
  transactions: (id: string) => ['accounts', id, 'transactions'] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: accountKeys.all,
    queryFn: () => api.get<{ accounts: Account[] }>('/api/accounts').then(r => r.accounts),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: accountKeys.detail(id),
    queryFn: () => api.get<{ account: Account }>(`/api/accounts/${id}`).then(r => r.account),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; initialBalance?: number }) =>
      api.post<{ account: Account }>('/api/accounts', data).then(r => r.account),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string }) =>
      api.put<{ account: Account }>(`/api/accounts/${id}`, data).then(r => r.account),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
      queryClient.invalidateQueries({ queryKey: accountKeys.detail(variables.id) });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all });
    },
  });
}
