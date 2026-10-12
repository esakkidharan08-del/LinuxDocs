const API_BASE = '/api';
let accessToken: string | null = null;

const setAccessToken = (token: string | null) => { accessToken = token; };

async function request<T>(endpoint: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && retry && !endpoint.startsWith('/auth/')) {
    try {
      const refreshed = await request<{ access_token: string }>('/auth/refresh', { method: 'POST' }, false);
      setAccessToken(refreshed.access_token);
      return request<T>(endpoint, options, false);
    } catch { setAccessToken(null); }
  }
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed') as Error & { 
      status: number; 
      errors?: Record<string, string> 
    };
    error.status = res.status;
    error.errors = data.errors;
    throw error;
  }

  return data as T;
}

export const authApi = {
  register: async (data: { username: string; email: string; password: string; confirm_password: string }) => {
    const response = await request<{ user: User; access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setAccessToken(response.access_token);
    return response;
  },

  login: async (data: { email: string; password: string; remember?: boolean }) => {
    const response = await request<{ user: User; access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setAccessToken(response.access_token);
    return response;
  },

  refresh: async () => {
    const response = await request<{ access_token: string }>('/auth/refresh', { method: 'POST' }, false);
    setAccessToken(response.access_token);
    return response;
  },

  logout: async () => {
    const response = await request<{ message: string }>('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    return response;
  },

  me: () =>
    request<{ user: User }>('/auth/me'),

  requestPasswordReset: (email: string) =>
    request<{ message: string }>('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }),

  resetPassword: (data: { token: string; password: string; confirm_password: string }) =>
    request<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),
};

export const userApi = {
  getMe: () =>
    request<{ user: User }>('/user/me'),

  getBookmarks: () =>
    request<{ bookmarks: Bookmark[] }>('/user/bookmarks'),

  toggleBookmark: (commandSlug: string) =>
    request<{ bookmarked: boolean; bookmark?: Bookmark }>('/user/bookmarks/toggle', {
      method: 'POST',
      body: JSON.stringify({ command_slug: commandSlug }),
    }),

  getNotes: () =>
    request<{ notes: UserNote[] }>('/user/notes'),

  upsertNote: (commandSlug: string, text: string) =>
    request<{ note: UserNote }>('/user/notes', {
      method: 'POST',
      body: JSON.stringify({ command_slug: commandSlug, text }),
    }),

  deleteNote: (commandSlug: string) =>
    request<{ message: string }>(`/user/notes/${commandSlug}`, { method: 'DELETE' }),

  getHistory: () =>
    request<{ history: HistoryEntry[] }>('/user/history'),

  addHistory: (commandSlug: string) =>
    request<{ message: string }>('/user/history/add', {
      method: 'POST',
      body: JSON.stringify({ command_slug: commandSlug }),
    }),

  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    request<{ message: string }>('/user/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteAccount: (confirm: string) =>
    request<{ message: string }>('/user/delete-account', {
      method: 'DELETE',
      body: JSON.stringify({ confirm }),
    }),
};

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface Bookmark {
  command_slug: string;
  created_at: string;
}

export interface UserNote {
  command_slug: string;
  text: string;
  updated_at: string;
}

export interface HistoryEntry {
  command_slug: string;
  viewed_at: string;
}
