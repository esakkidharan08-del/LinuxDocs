/* eslint-disable react/only-export-components -- context hooks are colocated with their providers on purpose */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { userApi } from '../services/api';
import { useAuth } from './AuthContext';
import {
  LEGACY_PROGRESS_STORES, PROGRESS_KEYS, dayKey, loadProgressCache, mergeProgressData, progressIntegration,
  removeLS, saveProgressCache, toSyncPayload,
} from '../lib/progress';
import type { ProgressKey, ProgressPayload, StreakDataSynced } from '../lib/progress';

/**
 * Synced learning progress owner (Part 2).
 *
 * One hydrated, per-user view of every progress namespace. The per-user
 * localStorage cache (`linuxdocs.progress-v1-u<id>`) is the offline end-state;
 * every page writes THROUGH this provider so writes land in the cache and in
 * the sync queue in exactly one place. On sign-in the provider pulls
 * /api/user/progress and folds server rows with the cached state using the
 * shared deterministic merge (never losing either side) — then re-pushes any
 * merged forward. Pre-Part-2 localStorage blobs ride along as a one-time
 * legacy absorption. Terminal scrollback and the flashcard deck preference
 * deliberately stay OUT of the synced payloads (device-local by design).
 */

type ProgressState = Partial<Record<ProgressKey, ProgressPayload>>;

interface ProgressContextType {
  /** false until the first hydration attempt for the current user finished */
  ready: boolean;
  progress: ProgressState;
  /** payload-shaped update for one key; persists + queues via the sync chip */
  updateProgress: (key: ProgressKey, updater: (prev: ProgressPayload | null) => unknown) => void;
  /** page-local storage blob → synced payload subset (no-op when unchanged) */
  reportBlob: (key: ProgressKey, blob: unknown) => void;
  /** daily visit streak tick — one per app load + after every sign-in */
  recordVisit: () => void;
  /** schema-v2 import: merge an imported progress map into the account */
  applyImported: (progress: Record<string, unknown>) => void;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

const EMPTY_STATE: ProgressState = {};

export const ProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, submitOp } = useAuth();
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<ProgressState>(EMPTY_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const userRef = useRef(user);
  userRef.current = user;
  const hydrationRunRef = useRef(0);

  /** Persist one payload and enqueue its delivery (chip: saving → synced). */
  const pushProgress = useCallback((userId: number, key: ProgressKey, payload: ProgressPayload) => {
    const cache = loadProgressCache(userId);
    const unchanged = cache.data[key] !== undefined
      && JSON.stringify(cache.data[key]) === JSON.stringify(payload);
    cache.data[key] = payload;
    saveProgressCache(userId, cache);
    if (unchanged) return;
    submitOp({ kind: 'progress', slug: key, data: payload, baseVersion: cache.versions[key] ?? 0, userId });
  }, [submitOp]);

  const applyPayload = useCallback((key: ProgressKey, payload: ProgressPayload | null) => {
    const u = userRef.current;
    if (!u || !payload) return;
    if (JSON.stringify(stateRef.current[key] ?? null) === JSON.stringify(payload)) return;
    setState((s) => ({ ...s, [key]: payload }));
    pushProgress(u.id, key, payload);
  }, [pushProgress]);

  const updateProgress = useCallback((key: ProgressKey, updater: (prev: ProgressPayload | null) => unknown) => {
    const next = toSyncPayload(key, updater(stateRef.current[key] ?? null));
    applyPayload(key, next);
  }, [applyPayload]);

  const reportBlob = useCallback((key: ProgressKey, blob: unknown) => {
    applyPayload(key, toSyncPayload(key, blob));
  }, [applyPayload]);

  const recordVisit = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    const prev: StreakDataSynced = (stateRef.current.streak as StreakDataSynced | undefined)
      ?? loadProgressCache(u.id).data.streak as StreakDataSynced | undefined
      ?? { lastDay: '', current: 0, best: 0, totalDays: 0 };
    const today = dayKey(new Date());
    if (prev.lastDay === today) return; // one record per day
    const yesterday = dayKey(new Date(Date.now() - 86_400_000));
    const continued = prev.lastDay === yesterday;
    applyPayload('streak', {
      lastDay: today,
      current: continued ? prev.current + 1 : 1,
      best: Math.max(prev.best, continued ? prev.current + 1 : 1),
      totalDays: prev.totalDays + 1,
    });
  }, [applyPayload]);

  const applyImported = useCallback((progress: Record<string, unknown>) => {
    for (const key of PROGRESS_KEYS as readonly ProgressKey[]) {
      if (!(key in progress)) continue;
      const payload = toSyncPayload(key, progress[key] ?? null);
      const prev = stateRef.current[key] ?? null;
      const merged = prev ? toSyncPayload(key, mergeProgressData(key, prev, payload ?? {})) : payload;
      applyPayload(key, merged);
    }
  }, [applyPayload]);

  /* ------------------------------------------------ legacy absorption ---- */

  const absorbLegacyStores = useCallback((userId: number) => {
    const cache = loadProgressCache(userId);
    for (const key of PROGRESS_KEYS as readonly ProgressKey[]) {
      const legacyKey = LEGACY_PROGRESS_STORES[key];
      if (legacyKey === undefined) continue;
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(legacyKey);
      } catch {
        raw = null;
      }
      if (!raw) continue;
      try {
        const payload = toSyncPayload(key, JSON.parse(raw));
        const prev = cache.data[key];
        // monotone join: the legacy device data can only ever ADD to the state
        cache.data[key] = prev ? (mergeProgressData(key, prev, payload) as ProgressPayload) : payload as ProgressPayload;
      } catch {
        /* corrupted legacy blob — start from the cache, ignore it */
      }
      // Scrolback lines and the deck preference still live in these keys;
      // everything that began as pure local progress is adopted once and the
      // old key goes away (same one-time convention as the guest store).
      if (key === 'learning' || key === 'speeddrill' || key === 'streak') removeLS(legacyKey!);
    }
    saveProgressCache(userId, cache);
    return cache;
  }, []);

  /* ------------------------------------------------------- hydration ----- */

  useEffect(() => {
    if (!user) {
      hydrationRunRef.current += 1; // invalidate in-flight hydration
      setReady(false);
      setState(EMPTY_STATE);
      return;
    }
    const run = ++hydrationRunRef.current;
    void (async () => {
      let server: Record<string, { version: number; data: unknown }> | null = null;
      try {
        server = (await userApi.getProgress()).progress;
      } catch {
        server = null; // offline boot — the cache stands until the queue drains
      }
      if (hydrationRunRef.current !== run) return; // signed out / switched meanwhile

      const cache = absorbLegacyStores(user.id);
      const next: ProgressState = {};
      const queue: Array<{ key: ProgressKey; payload: ProgressPayload }> = [];
      for (const key of PROGRESS_KEYS as readonly ProgressKey[]) {
        const local = cache.data[key] ?? null;
        const row = server?.[key];
        const serverData = row ? row.data : null;
        const merged: ProgressPayload | null = (local !== null && serverData !== null && serverData !== undefined)
          ? (mergeProgressData(key, serverData, local) as ProgressPayload)
          : (local ?? (serverData as ProgressPayload | null));
        if (row) cache.versions[key] = row.version;
        if (merged) {
          cache.data[key] = merged;
          next[key] = merged;
          if (!row || JSON.stringify(row.data ?? null) !== JSON.stringify(merged)) {
            queue.push({ key, payload: merged });
          }
        }
      }
      saveProgressCache(user.id, cache);
      setState({ ...EMPTY_STATE, ...next });
      setReady(true);
      for (const { key, payload } of queue) {
        submitOp({ kind: 'progress', slug: key, data: payload, baseVersion: cache.versions[key] ?? 0, userId: user.id });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, absorbLegacyStores]);

  /* queue-replay 409 merges land here (deterministic merge by AuthContext) */
  useEffect(() => {
    progressIntegration.onMerged = (key, payload) => setState((s) => ({ ...s, [key]: payload }));
    return () => { progressIntegration.onMerged = null; };
  }, []);

  return (
    <ProgressContext.Provider value={{ ready, progress: state, updateProgress, reportBlob, recordVisit, applyImported }}>
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
};
