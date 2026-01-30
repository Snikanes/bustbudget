import { useQuery } from '@tanstack/react-query';
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
