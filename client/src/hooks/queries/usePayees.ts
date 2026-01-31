import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Payee, PayeeWithDetails } from '@/types';
import { api } from '@/api/client';

export const payeeKeys = {
  all: ['payees'] as const,
  detail: (id: string) => ['payees', id] as const,
};

export function usePayees() {
  return useQuery({
    queryKey: payeeKeys.all,
    queryFn: () =>
      api
        .get<{ payees: Payee[] }>('/api/payees')
        .then((r) => r.payees),
  });
}

export function usePayeeDetails(id: string | null) {
  return useQuery({
    queryKey: payeeKeys.detail(id || ''),
    queryFn: () =>
      api
        .get<{ payee: PayeeWithDetails }>(`/api/payees/${id}`)
        .then((r) => r.payee),
    enabled: !!id,
  });
}

export function useCreatePayee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      api
        .post<{ payee: Payee }>('/api/payees', { name })
        .then((r) => r.payee),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payeeKeys.all });
    },
  });
}

export function useUpdatePayee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api
        .put<{ payee: Payee }>(`/api/payees/${id}`, { name })
        .then((r) => r.payee),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: payeeKeys.all });
      queryClient.invalidateQueries({ queryKey: payeeKeys.detail(variables.id) });
    },
  });
}

export function useDeletePayee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/payees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: payeeKeys.all });
    },
  });
}
