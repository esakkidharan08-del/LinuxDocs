import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, userApi } from '../services/api';
import type { User } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ errors?: Record<string, string> }>;
  register: (data: { username: string; email: string; password: string; confirm_password: string }) => Promise<{ errors?: Record<string, string> }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  // User data
  bookmarks: Set<string>;
  notes: Map<string, string>;
  history: string[];
  refreshUserData: () => Promise<void>;
  toggleBookmark: (slug: string) => Promise<void>;
  saveNote: (slug: string, text: string) => Promise<void>;
  deleteNote: (slug: string) => Promise<void>;
  addHistory: (slug: string) => Promise<void>;
  importData: (data: { bookmarks: string[]; notes: { command_slug: string; text: string }[] }) => Promise<void>;
  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) => Promise<{ errors?: Record<string, string> }>;
  deleteAccount: (confirm: string) => Promise<{ errors?: Record<string, string> }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [history, setHistory] = useState<string[]>([]);

  const fetchUser = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      await authApi.refresh();
      await fetchUser();
      await refreshUserData();
    } catch {
      setUser(null);
      setLoading(false);
    }
  }, [fetchUser]);

  const refreshUserData = useCallback(async () => {
    try {
      const [{ bookmarks: bm }, { notes: nt }, { history: hist }] = await Promise.all([
        userApi.getBookmarks(),
        userApi.getNotes(),
        userApi.getHistory(),
      ]);
      setBookmarks(new Set(bm.map((b) => b.command_slug)));
      setNotes(new Map(nt.map((n) => [n.command_slug, n.text])));
      setHistory(hist.map((h) => h.command_slug));
    } catch {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, password: string, remember = true) => {
    try {
      const response = await authApi.login({ email, password, remember });
      setUser(response.user);
      await refreshUserData();
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  };

  const register = async (data: { username: string; email: string; password: string; confirm_password: string }) => {
    try {
      const response = await authApi.register(data);
      setUser(response.user);
      await refreshUserData();
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setBookmarks(new Set());
    setNotes(new Map());
    setHistory([]);
  };

  const toggleBookmark = async (slug: string) => {
    if (!user) return;
    try {
      const { bookmarked } = await userApi.toggleBookmark(slug);
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (bookmarked) next.add(slug);
        else next.delete(slug);
        return next;
      });
    } catch {
      // ignore
    }
  };

  const saveNote = async (slug: string, text: string) => {
    if (!user) return;
    try {
      const { note } = await userApi.upsertNote(slug, text);
      setNotes((prev) => new Map(prev).set(note.command_slug, note.text));
    } catch {
      // ignore
    }
  };

  const deleteNote = async (slug: string) => {
    if (!user) return;
    try {
      await userApi.deleteNote(slug);
      setNotes((prev) => {
        const next = new Map(prev);
        next.delete(slug);
        return next;
      });
    } catch {
      // ignore
    }
  };

  const addHistory = async (slug: string) => {
    if (!user) return;
    try {
      await userApi.addHistory(slug);
      setHistory((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 15));
    } catch {
      // ignore
    }
  };

  const importData = async (data: { bookmarks: string[]; notes: { command_slug: string; text: string }[] }) => {
    if (!user) return;
    await userApi.importData(data);
    await refreshUserData();
  };

  const changePassword = async (data: { current_password: string; new_password: string; confirm_password: string }) => {
    try {
      await userApi.changePassword(data);
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  };

  const deleteAccount = async (confirm: string) => {
    try {
      await userApi.deleteAccount(confirm);
      await logout();
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshAuth,
        bookmarks,
        notes,
        history,
        refreshUserData,
        toggleBookmark,
        saveNote,
        deleteNote,
        addHistory,
        importData,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
