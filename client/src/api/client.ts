import { useAuthStore } from '../stores/authStore';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  // Handle 401 Unauthorized - trigger logout
  if (response.status === 401) {
    useAuthStore.getState().logout();
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: { code: 'UNKNOWN_ERROR', message: 'An error occurred' },
    }));
    throw new ApiError(
      response.status,
      error.error?.code || 'UNKNOWN_ERROR',
      error.error?.message || 'An error occurred',
      error.error?.details
    );
  }
  return response.json();
}

const defaultOptions: RequestInit = {
  credentials: 'include' as RequestCredentials,
};

export const api = {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(url, defaultOptions);
    return handleResponse<T>(response);
  },

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      ...defaultOptions,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      ...defaultOptions,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T = void>(url: string): Promise<T> {
    const response = await fetch(url, { ...defaultOptions, method: 'DELETE' });
    if (response.status === 204) {
      return undefined as T;
    }
    return handleResponse<T>(response);
  },
};

// Auth-specific API calls (these don't use the standard error handling for 401)
export const authApi = {
  async googleLogin(idToken: string): Promise<{ user: { id: string; email: string; name: string | null; picture: string | null } }> {
    const response = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Login failed' } }));
      throw new Error(error.error?.message || 'Login failed');
    }
    return response.json();
  },

  async getMe(): Promise<{ user: { id: string; email: string; name: string | null; picture: string | null } }> {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    return response.json();
  },

  async refresh(): Promise<void> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  },
};
