import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ImportProfile } from '@/types/importMapping';
import { ImportMappingConfig } from '@/types/importMapping';
import { api } from '@/api/client';

export const importProfileKeys = {
  all: ['import-profiles'] as const,
};

export function useImportProfiles() {
  return useQuery({
    queryKey: importProfileKeys.all,
    queryFn: () =>
      api
        .get<{ profiles: ImportProfile[] }>('/api/import-profiles')
        .then((r) => r.profiles),
  });
}

export function useCreateImportProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; fileType: string; config: ImportMappingConfig }) =>
      api
        .post<{ profile: ImportProfile }>('/api/import-profiles', data)
        .then((r) => r.profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importProfileKeys.all });
    },
  });
}

export function useUpdateImportProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; config?: ImportMappingConfig }) =>
      api
        .put<{ profile: ImportProfile }>(`/api/import-profiles/${id}`, data)
        .then((r) => r.profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importProfileKeys.all });
    },
  });
}

export function useDeleteImportProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/import-profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importProfileKeys.all });
    },
  });
}
