const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

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
  register: (data: { username: string; email: string; password: string; confirm_password: string }) =>
    request<{ user: User; access_token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string; remember?: boolean }) =>
    request<{ user: User; access_token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refresh: () =>
    request<{ access_token: string }>('/auth/refresh', { method: 'POST' }),

  logout: () =>
    request<{ message: string }>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ user: User }>('/auth/me'),
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