import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ImportPayeeMapping } from '@/types';
import { api } from '@/api/client';
import { payeeKeys } from './usePayees';

export const importPayeeMappingKeys = {
  all: ['import-payee-mappings'] as const,
};

export function useImportPayeeMappings() {
  return useQuery({
    queryKey: importPayeeMappingKeys.all,
    queryFn: () =>
      api
        .get<{ mappings: ImportPayeeMapping[] }>('/api/import-payee-mappings')
        .then((r) => r.mappings),
  });
}

export function useCreateImportPayeeMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { originalPayee: string; payeeId: string }) =>
      api
        .post<{ mapping: ImportPayeeMapping }>('/api/import-payee-mappings', data)
        .then((r) => r.mapping),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: importPayeeMappingKeys.all });
      // Also invalidate the payee details to refresh renaming rules
      queryClient.invalidateQueries({ queryKey: payeeKeys.detail(variables.payeeId) });
    },
  });
}

export function useDeleteImportPayeeMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/import-payee-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importPayeeMappingKeys.all });
      // Invalidate all payee details to refresh renaming rules
      queryClient.invalidateQueries({ queryKey: ['payees'] });
    },
  });
}
