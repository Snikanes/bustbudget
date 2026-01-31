import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Payee } from '@/types';
import { api } from '@/api/client';

export const payeeKeys = {
  all: ['payees'] as const,
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
