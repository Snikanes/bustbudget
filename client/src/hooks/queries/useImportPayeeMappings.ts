import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ImportPayeeMapping } from '@/types';
import { api } from '@/api/client';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importPayeeMappingKeys.all });
    },
  });
}

export function useDeleteImportPayeeMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/import-payee-mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importPayeeMappingKeys.all });
    },
  });
}
