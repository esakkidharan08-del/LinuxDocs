const API_BASE = '/api';
let accessToken: string | null = null;
// Concurrent 401s used to each fire their own /auth/refresh, and every one of
// those rotates the server-side session. Many parallel calls therefore meant
// many rotations per second - churn in the sessions table, and enough volume
// to trip the legitimate-traffic rate limit (which signs the user out).
// Single-flight: all waiters share one in-flight refresh.
let refreshInFlight: Promise<string> | null = null;

const setAccessToken = (token: string | null) => { accessToken = token; };

function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    const attempt = (async () => {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Session expired');
      }
      const data = await res.json();
      accessToken = data.access_token;
      return data.access_token as string;
    })();
    refreshInFlight = attempt;
    attempt.catch(() => { /* propagated to the caller */ })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

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
      await refreshAccessToken();
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
    const access_token = await refreshAccessToken();
    return { access_token };
  },

  logout: async () => {
    const response = await request<{ message: string }>('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    return response;
  },

  me: () =>
    request<{ user: User }>('/auth/me'),

  requestPasswordReset: (email: string) =>
    request<{ message: string; email_configured: boolean }>('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) }),

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

  importData: (data: { bookmarks: string[]; notes: { command_slug: string; text: string }[] }) =>
    request<{ message: string }>('/user/data/import', { method: 'POST', body: JSON.stringify(data) }),

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

export const commandsApi = {
  list: () => request<{ categories: import('../types').CategoryInfo[]; domains: import('../types').CTFDomainInfo[]; commands: import('../types').Command[] }>('/commands'),
  get: (slug: string) => request<{ command: import('../types').Command }>(`/commands/${encodeURIComponent(slug)}`),
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
