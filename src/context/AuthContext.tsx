/* eslint-disable react/only-export-components -- context hooks are colocated with their providers on purpose */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi, userApi } from '../services/api';
import type { User } from '../services/api';
import {
  INITIAL_SYNC_STATE, backoffDelayMs, enqueueOp, isGuestStore, isQueueFile,
  markFailed, markIdle, markSavedLocal, markSaving, markSynced,
  safeParseJson, emptyGuestStore,
  GUEST_STORE_VERSION, QUEUE_VERSION,
} from '../lib/syncState';
import type { GuestStore, SyncOp, SyncState } from '../lib/syncState';

export { syncLabel } from '../lib/syncState';
export type { SyncState, SyncPhase } from '../lib/syncState';

/** Distributive Omit so submitOp accepts any single op variant. */
type OpInput<T> = T extends SyncOp ? Omit<T, 'id'> & { id?: number } : never;

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
  /** Server-confirmed sync status for the Dashboard chip (see lib/syncState.ts). */
  sync: SyncState;
  retrySync: () => void;
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

/**
 * "A session might exist" marker in localStorage. The refresh cookie is HttpOnly
 * (unreadable from JS), so on boot we can't tell "guest" from "cookie died" —
 * calling /auth/refresh for every guest made the F12 console show a red 401 on
 * every public page. The marker is set on successful sign-in/refresh and cleared
 * on sign-out or a failed refresh; guests with no marker skip the refresh call
 * and get a completely clean console.
 */
const SESSION_HINT = 'linuxdocs.auth-visible';
/** Guest-mode bookmarks/notes/history — converted into queued ops at sign-in. */
const GUEST_KEY = 'linuxdocs.guest-data-v1';
/** Persisted offline-delivery queue (per-user tagged; survives reloads). */
const QUEUE_KEY = 'linuxdocs.sync-queue-v1';

const hasSessionHint = () => {
  try {
    return localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return false;
  }
};

const markSession = () => {
  try {
    localStorage.setItem(SESSION_HINT, '1');
  } catch {
    // private mode etc. — the app still works, just boot-refreshes every time
  }
};

const unmarkSession = () => {
  try {
    localStorage.removeItem(SESSION_HINT);
  } catch {
    // ignore
  }
};

const readLS = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLS = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const removeLS = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const loadQueue = (): SyncOp[] => safeParseJson(readLS(QUEUE_KEY), isQueueFile)?.ops ?? [];

const saveQueue = (ops: SyncOp[]) => {
  if (ops.length) writeLS(QUEUE_KEY, JSON.stringify({ version: QUEUE_VERSION, ops }));
  else removeLS(QUEUE_KEY);
};

const loadGuestStore = (): GuestStore => safeParseJson(readLS(GUEST_KEY), isGuestStore) ?? emptyGuestStore();

const saveGuestStore = (store: GuestStore) => {
  const any = store.bookmarks.length || store.notes.length || store.history.length;
  if (any) writeLS(GUEST_KEY, JSON.stringify({ ...store, version: GUEST_STORE_VERSION }));
  else removeLS(GUEST_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [history, setHistory] = useState<string[]>([]);
  // Current-state mirrors for useCallback'd mutators (identity-stable fns that
  // still read fresh data; the mirror updates before any user click can land).
  const bookmarksRef = useRef(bookmarks);
  useEffect(() => {
    bookmarksRef.current = bookmarks;
  }, [bookmarks]);
  const [sync, setSync] = useState<SyncState>(INITIAL_SYNC_STATE);

  /** Stale-response guards: every pull and per-record op is tagged & checked. */
  const pullSeqRef = useRef(0);
  const lastOpRef = useRef(new Map<string, number>());
  const opIdRef = useRef(Math.floor(Date.now() / 1000) * 1000);
  const queueRef = useRef<SyncOp[]>(loadQueue());
  const drainInFlightRef = useRef(false);
  const drainAttemptRef = useRef(0);
  const drainTimerRef = useRef<number | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const readLocalQueue = () => queueRef.current;

  /* ------------------------------------------------------------------ guest */

  const hydrateFromGuestStore = useCallback(() => {
    const store = loadGuestStore();
    setBookmarks(new Set(store.bookmarks.map((b) => b.slug)));
    setNotes(new Map(store.notes.map((n) => [n.command_slug, n.text])));
    setHistory(store.history.map((h) => h.command_slug));
  }, []);

  /* ------------------------------------------------------------------- pull */

  const refreshUserData = useCallback(async () => {
    const myPull = ++pullSeqRef.current;
    setSync((s) => (s.phase === 'saved-local' ? s : markSaving())); // pending ops stay labeled
    try {
      const [{ bookmarks: bm }, { notes: nt }, { history: hist }] = await Promise.all([
        userApi.getBookmarks(),
        userApi.getNotes(),
        userApi.getHistory(),
      ]);
      if (pullSeqRef.current !== myPull) return; // a newer pull or sign-out won
      setBookmarks(new Set(bm.map((b) => b.command_slug)));
      setNotes(new Map(nt.map((n) => [n.command_slug, n.text])));
      setHistory(hist.map((h) => h.command_slug));
      setSync((s) => (s.phase === 'saved-local' ? s : markSynced())); // server 2xx confirmed
    } catch {
      if (pullSeqRef.current !== myPull) return;
      setSync(markFailed('showing last synced data'));
    }
  }, []);

  /* ------------------------------------------------------------------ drain */

  const executeOp = useCallback(async (op: SyncOp): Promise<'ok' | 'retry' | 'fatal'> => {
    try {
      switch (op.kind) {
        case 'bookmark':
          await userApi.setBookmark(op.slug, op.wanted);
          return 'ok';
        case 'note-set':
          await userApi.upsertNote(op.slug, op.text);
          return 'ok';
        case 'note-del':
          try {
            await userApi.deleteNote(op.slug);
          } catch (err: any) {
            if (err?.status === 404) return 'ok'; // already gone — ack
            throw err;
          }
          return 'ok';
        case 'history':
          await userApi.addHistory(op.slug);
          return 'ok';
      }
    } catch (err: any) {
      const status = err?.status as number | undefined;
      if (status && status !== 429 && status >= 400 && status < 500) return 'fatal';
      return 'retry'; // offline, 5xx, or rate-limited — deliver later
    }
    return 'fatal';
  }, []);

  const scheduleDrain = useCallback((delay?: number) => {
    if (drainTimerRef.current !== null) return;
    const wait = delay ?? backoffDelayMs(drainAttemptRef.current);
    drainTimerRef.current = window.setTimeout(() => {
      drainTimerRef.current = null;
      drainQueueRef.current?.();
    }, wait);
  }, []);

  const drainQueue = useCallback(async () => {
    if (drainInFlightRef.current) return;
    const queue = readLocalQueue();
    const u = userRef.current;
    if (!u || !queue.some((op) => op.userId === u.id)) {
      if (!queue.length) drainAttemptRef.current = 0;
      return;
    }
    drainInFlightRef.current = true;
    setSync((s) => (s.phase === 'saved-local' ? markSaving() : s));
    let hadFatal = false;
    try {
      // Sequential delivery keeps ordering deterministic and requests one at a
      // time — replay idempotency comes from end-state ops, not from ordering.
      for (const op of [...queueRef.current]) {
        if (op.userId !== u.id) continue; // other account's parked ops stay parked
        const result = await executeOp(op);
        if (result === 'retry') {
          drainAttemptRef.current += 1;
          setSync(markSavedLocal(`${queueRef.current.length} change${queueRef.current.length === 1 ? '' : 's'} pending`));
          return; // will be rescheduled below
        }
        // fatal OR ok — remove from the queue either way
        queueRef.current = queueRef.current.filter((o) => o.id !== op.id);
        saveQueue(queueRef.current);
        if (result === 'fatal') {
          hadFatal = true;
          continue;
        }
        const key = `${op.kind}:${op.slug}`;
        const isLatest = lastOpRef.current.get(key) === op.id;
        if (isLatest) {
          // Confirm the local state from the server's perspective.
          if (op.kind === 'bookmark' && op.wanted) {
            setBookmarks((prev) => new Set(prev).add(op.slug));
          } else if (op.kind === 'bookmark') {
            setBookmarks((prev) => {
              const next = new Set(prev);
              next.delete(op.slug);
              return next;
            });
          } else if (op.kind === 'note-set') {
            setNotes((prev) => new Map(prev).set(op.slug, op.text));
          } else if (op.kind === 'note-del') {
            setNotes((prev) => {
              const next = new Map(prev);
              next.delete(op.slug);
              return next;
            });
          }
          lastOpRef.current.delete(key);
        }
        if (!queueRef.current.some((o) => o.userId === u.id)) {
          drainAttemptRef.current = 0;
          // Every pending change for this account is now server-confirmed —
          // unless one was permanently rejected, which must stay visible.
          setSync(hadFatal ? markFailed('some changes were rejected') : markSynced());
        }
      }
    } finally {
      drainInFlightRef.current = false;
    }
    if (readLocalQueue().some((op) => op.userId === u.id)) scheduleDrain();
  }, [executeOp, scheduleDrain]);
  const drainQueueRef = useRef<(() => Promise<void>) | null>(null);
  drainQueueRef.current = drainQueue;

  // Deliver as soon as connectivity returns, and keep an idle backoff ticker
  // while anything is parked.
  useEffect(() => {
    const onOnline = () => drainQueueRef.current?.();
    window.addEventListener('online', onOnline);
    const ticker = window.setInterval(() => {
      if (readLocalQueue().length && userRef.current) drainQueueRef.current?.();
    }, 30_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(ticker);
    };
  }, []);

  /** Enqueue + immediate delivery attempt (falls into offline queue on failure). */
  const submitOp = useCallback((op: OpInput<SyncOp>) => {
    const full = { ...op, id: op.id ?? ++opIdRef.current } as SyncOp;
    const key = `${full.kind}:${full.slug}`;
    lastOpRef.current.set(key, full.id);
    queueRef.current = enqueueOp(queueRef.current, full);
    saveQueue(queueRef.current);
    setSync(markSavedLocal(`${queueRef.current.length} change${queueRef.current.length === 1 ? '' : 's'} pending`));
    // attempt NOW; drainQueue re-queues on failure with backoff
    void drainQueueRef.current?.();
  }, []);

  /** Convert the guest store into idempotent queued ops for this account
   *  (deterministic merge: guest records win for records it touched) and
   *  clear it — the data now lives durably in the persisted queue. */
  const absorbGuestStore = useCallback((u: User | null) => {
    if (!u) return;
    const store = loadGuestStore();
    store.bookmarks.forEach((b) => submitOp({ kind: 'bookmark', slug: b.slug, wanted: true, userId: u.id }));
    store.notes.forEach((n) => submitOp({ kind: 'note-set', slug: n.command_slug, text: n.text, userId: u.id }));
    store.history.slice(0, 15).forEach((h) => submitOp({ kind: 'history', slug: h.command_slug, userId: u.id }));
    if (store.bookmarks.length || store.notes.length || store.history.length) {
      removeLS(GUEST_KEY); // now carried durably by the queue
    }
  }, [submitOp]);

  /* ------------------------------------------------------------------- boot */

  const fetchUser = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      userRef.current = user;
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
    let sessionOk = false;
    try {
      await authApi.refresh();
      sessionOk = true;
    } catch {
      // no valid refresh cookie — guest (or expired session)
    }
    try {
      if (sessionOk) {
        markSession();
        const u = await fetchUser();
        if (u) {
          userRef.current = u; // ops submitted below must see the new session
          absorbGuestStore(u);
          await refreshUserData();
          void drainQueueRef.current?.();
        }
      } else {
        unmarkSession();
        setUser(null);
        hydrateFromGuestStore();
        setSync(markIdle());
      }
    } catch {
      // refresh cookie was fine but profile/data failed (offline etc.) — leave UI neutral
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchUser, refreshUserData, hydrateFromGuestStore, absorbGuestStore]);

  useEffect(() => {
    if (hasSessionHint()) {
      refreshAuth();
    } else {
      setLoading(false); // never signed in on this device — skip the refresh call entirely
      hydrateFromGuestStore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------- auth */

  const login = useCallback(async (email: string, password: string, remember = true) => {
    try {
      const response = await authApi.login({ email, password, remember });
      markSession();
      userRef.current = response.user;
      pullSeqRef.current += 1; // invalidate any pre-login pulls
      setUser(response.user);
      absorbGuestStore(response.user);   // guest merge — same rule as boot
      await refreshUserData();
      void drainQueueRef.current?.();
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  }, [absorbGuestStore, refreshUserData]);

  const register = useCallback(async (data: { username: string; email: string; password: string; confirm_password: string }) => {
    try {
      const response = await authApi.register(data);
      markSession();
      userRef.current = response.user;
      pullSeqRef.current += 1;
      setUser(response.user);
      absorbGuestStore(response.user);   // guest merge — same rule as boot
      await refreshUserData();
      void drainQueueRef.current?.();
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  }, [absorbGuestStore, refreshUserData]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    unmarkSession();
    pullSeqRef.current += 1; // in-flight pulls/mutations for the old session are stale now
    setUser(null);
    setBookmarks(new Set());
    setNotes(new Map());
    setHistory([]);
    setSync(markIdle());
    hydrateFromGuestStore(); // guest mode continues with its own (device) data
  }, [hydrateFromGuestStore]);

  /* -------------------------------------------------------------- mutations */

  const toggleBookmark = useCallback(async (slug: string) => {
    const u = userRef.current;
    if (!u) {
      // Guests keep a device-local store; signing in later converts it to ops.
      const store = loadGuestStore();
      const has = store.bookmarks.some((b) => b.slug === slug);
      store.bookmarks = has
        ? store.bookmarks.filter((b) => b.slug !== slug)
        : [...store.bookmarks, { slug, saved_at: new Date().toISOString() }];
      saveGuestStore(store);
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (has) next.delete(slug);
        else next.add(slug);
        return next;
      });
      setSync(markSavedLocal());
      return;
    }
    const wanted = !bookmarksRef.current.has(slug);
    // Optimistic flip; the queue op carries the desired END STATE, so offline
    // replays always deliver exactly what the user last chose.
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (wanted) next.add(slug);
      else next.delete(slug);
      return next;
    });
    submitOp({ kind: 'bookmark', slug, wanted, userId: u.id });
  }, [submitOp]);

  const saveNote = useCallback(async (slug: string, text: string) => {
    const u = userRef.current;
    if (!u) {
      const store = loadGuestStore();
      store.notes = [
        ...store.notes.filter((n) => n.command_slug !== slug),
        { command_slug: slug, text: text.trim(), saved_at: new Date().toISOString() },
      ];
      saveGuestStore(store);
      setNotes((prev) => new Map(prev).set(slug, text.trim()));
      setSync(markSavedLocal());
      return;
    }
    setNotes((prev) => new Map(prev).set(slug, text.trim()));
    submitOp({ kind: 'note-set', slug, text: text.trim(), userId: u.id });
  }, [submitOp]);

  const deleteNote = useCallback(async (slug: string) => {
    const u = userRef.current;
    if (!u) {
      const store = loadGuestStore();
      store.notes = store.notes.filter((n) => n.command_slug !== slug);
      saveGuestStore(store);
      setNotes((prev) => {
        const next = new Map(prev);
        next.delete(slug);
        return next;
      });
      setSync(markIdle());
      return;
    }
    setNotes((prev) => {
      const next = new Map(prev);
      next.delete(slug);
      return next;
    });
    submitOp({ kind: 'note-del', slug, userId: u.id });
  }, [submitOp]);

  const addHistory = useCallback(async (slug: string) => {
    const u = userRef.current;
    if (!u) {
      const store = loadGuestStore();
      store.history = [
        { command_slug: slug, viewed_at: new Date().toISOString() },
        ...store.history.filter((h) => h.command_slug !== slug),
      ].slice(0, 15);
      saveGuestStore(store);
      setHistory((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 15));
      return;
    }
    setHistory((prev) => [slug, ...prev.filter((s) => s !== slug)].slice(0, 15));
    submitOp({ kind: 'history', slug, userId: u.id });
  }, [submitOp]);

  const importData = useCallback(async (data: { bookmarks: string[]; notes: { command_slug: string; text: string }[] }) => {
    if (!userRef.current) return;
    await userApi.importData(data);
    await refreshUserData();
  }, [refreshUserData]);

  const retrySync = useCallback(() => {
    void drainQueueRef.current?.();
    if (userRef.current) void refreshUserData();
  }, [refreshUserData]);

  const changePassword = useCallback(async (data: { current_password: string; new_password: string; confirm_password: string }) => {
    try {
      await userApi.changePassword(data);
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  }, []);

  const deleteAccount = useCallback(async (confirm: string) => {
    try {
      await userApi.deleteAccount(confirm);
      await logout();
      return {};
    } catch (err: any) {
      return { errors: err.errors || { general: err.message } };
    }
  }, [logout]);

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
        sync,
        retrySync,
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
