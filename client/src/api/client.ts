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

export const api = {
  async get<T>(url: string): Promise<T> {
    const response = await fetch(url);
    return handleResponse<T>(response);
  },

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T = void>(url: string): Promise<T> {
    const response = await fetch(url, { method: 'DELETE' });
    if (response.status === 204) {
      return undefined as T;
    }
    return handleResponse<T>(response);
  },
};
