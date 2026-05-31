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

// Deduplicates concurrent refresh attempts so parallel requests don't each trigger a refresh
let refreshPromise: Promise<void> | null = null;

function attemptRefresh(): Promise<void> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
      .then(r => {
        if (!r.ok) throw new Error('Refresh failed');
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function parseResponse<T>(response: Response): Promise<T> {
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

async function executeWithRefresh<T>(
  requestFn: () => Promise<Response>,
  processResponse: (r: Response) => Promise<T>
): Promise<T> {
  const response = await requestFn();

  if (response.status !== 401) {
    return processResponse(response);
  }

  // Access token expired — try to refresh silently
  try {
    await attemptRefresh();
    return processResponse(await requestFn());
  } catch {
    useAuthStore.getState().logout();
    throw new ApiError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
  }
}

const defaultOptions: RequestInit = {
  credentials: 'include' as RequestCredentials,
};

export const api = {
  async get<T>(url: string): Promise<T> {
    return executeWithRefresh(
      () => fetch(url, defaultOptions),
      r => parseResponse<T>(r)
    );
  },

  async post<T>(url: string, data?: unknown): Promise<T> {
    const requestFn = () =>
      fetch(url, {
        ...defaultOptions,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });
    return executeWithRefresh(requestFn, r => parseResponse<T>(r));
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    const requestFn = () =>
      fetch(url, {
        ...defaultOptions,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: data ? JSON.stringify(data) : undefined,
      });
    return executeWithRefresh(requestFn, r => parseResponse<T>(r));
  },

  async delete<T = void>(url: string): Promise<T> {
    const requestFn = () => fetch(url, { ...defaultOptions, method: 'DELETE' });
    return executeWithRefresh(requestFn, async r => {
      if (r.status === 204) return undefined as T;
      return parseResponse<T>(r);
    });
  },
};

// Auth-specific API calls (bypass the standard error handling for 401)
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
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.status === 401) {
      // Try to refresh before giving up
      try {
        await attemptRefresh();
        const retried = await fetch('/api/auth/me', { credentials: 'include' });
        if (!retried.ok) throw new Error('Not authenticated');
        return retried.json();
      } catch {
        throw new Error('Not authenticated');
      }
    }
    if (!response.ok) {
      throw new Error('Not authenticated');
    }
    return response.json();
  },

  async refresh(): Promise<void> {
    return attemptRefresh();
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  },
};
