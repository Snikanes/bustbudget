import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/client';
import { useAuthStore, User } from '../../stores/authStore';
import { useEffect } from 'react';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
};

export function useCheckAuth() {
  const { setUser, setLoading } = useAuthStore();

  const query = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      const { user } = await authApi.getMe();
      return user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (query.isSuccess) {
      setUser(query.data);
      setLoading(false);
    } else if (query.isError) {
      setUser(null);
      setLoading(false);
    }
  }, [query.isSuccess, query.isError, query.data, setUser, setLoading]);

  return query;
}

export function useGoogleLogin() {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (idToken: string) => {
      const { user } = await authApi.googleLogin(idToken);
      return user;
    },
    onSuccess: (user) => {
      setUser(user as User);
      queryClient.setQueryData(authKeys.me(), user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { logout } = useAuthStore();

  return useMutation({
    mutationFn: async () => {
      await authApi.logout();
    },
    onSuccess: () => {
      logout();
      queryClient.clear();
    },
  });
}

export function useRefreshToken() {
  return useMutation({
    mutationFn: async () => {
      await authApi.refresh();
    },
  });
}
