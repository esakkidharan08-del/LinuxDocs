/* ============================================================
   Synced learning progress (Part 2) — shared client-side rules.

   This module is deliberately REACT-FREE and framework-free: it is
   imported by the app AND executed directly by the Node-side test
   qa/merge_test.mjs, which runs the very same vectors as the pytest
   loader (backend/tests/test_progress_merge.py) — one contract file,
   two implementations, no drift:

     • backend/app/progress_merge.py   (authoritative server-side)
     • src/lib/progress.ts             (this file)

   Merge shape per key (pinned by backend/app/progress_schemas.py):
     learning    — Record<pathId, {completed, bestScore, bestTotal, lessons}>
     terminal    — {solved: string[], commandsRun: number}   (scrollback stays device-local)
     flashcards  — {completes: Record<deckId, number>}       (lastDeck stays device-local)
     speeddrill  — {best: number, plays: number}
     streak      — {lastDay, current, best, totalDays}       (client-local date, ±1-day server window)

   The merge is a pure join (commutative, idempotent, order-independent)
   so conflict retries and offline replays always converge.
   ============================================================ */

export const PROGRESS_MERGE_VERSION = 1; // bump together with qa/merge_vectors.json
export const PROGRESS_KEYS = ['learning', 'terminal', 'flashcards', 'speeddrill', 'streak'] as const;
export type ProgressKey = (typeof PROGRESS_KEYS)[number];

export type LearningEntry = { completed: boolean; bestScore: number; bestTotal: number; lessons: string[] };
export type LearningData = Record<string, LearningEntry>;
export type TerminalData = { solved: string[]; commandsRun: number };
export type FlashcardsData = { completes: Record<string, number> };
export type SpeeddrillData = { best: number; plays: number };
export type StreakDataSynced = { lastDay: string; current: number; best: number; totalDays: number };
export type ProgressPayload = LearningData | TerminalData | FlashcardsData | SpeeddrillData | StreakDataSynced;

/* --------------------------------------------------------------- helpers */

type AnyDict = Record<string, unknown>;

const isDict = (v: unknown): v is AnyDict => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const asDict = (v: unknown): AnyDict => (isDict(v) ? (v as AnyDict) : {});
const asInt = (v: unknown): number => (isInt(v) ? (v as number) : 0);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);

/** Union of two lists as a sorted array of strings. */
function unionSorted(a: unknown, b: unknown): string[] {
  return Array.from(new Set([...asList(a), ...asList(b)].map(String))).sort();
}

/** Stable canonical JSON (sorted object keys) for equality checks. */
export function canonJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonJson).join(',')}]`;
  if (isDict(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/* ---------------------------------------------------------------- merge */

function mergeLearning(a: unknown, b: unknown): LearningData {
  const da = asDict(a);
  const db = asDict(b);
  const merged: LearningData = {};
  for (const pathId of Array.from(new Set([...Object.keys(da), ...Object.keys(db)])).sort()) {
    const ea = asDict(da[pathId]);
    const eb = asDict(db[pathId]);
    merged[pathId] = {
      completed: ea.completed === true || eb.completed === true,
      bestScore: Math.max(asInt(ea.bestScore), asInt(eb.bestScore)),
      bestTotal: Math.max(asInt(ea.bestTotal), asInt(eb.bestTotal)),
      lessons: unionSorted(ea.lessons, eb.lessons),
    };
  }
  return merged;
}

function mergeTerminal(a: unknown, b: unknown): TerminalData {
  return {
    solved: unionSorted(asDict(a).solved, asDict(b).solved),
    commandsRun: Math.max(asInt(asDict(a).commandsRun), asInt(asDict(b).commandsRun)),
  };
}

function mergeFlashcards(a: unknown, b: unknown): FlashcardsData {
  const ca = asDict(asDict(a).completes);
  const cb = asDict(asDict(b).completes);
  const completes: Record<string, number> = {};
  for (const deckId of Array.from(new Set([...Object.keys(ca), ...Object.keys(cb)])).sort()) {
    const deck = Math.max(asInt(ca[deckId]), asInt(cb[deckId]));
    if (deck > 0) completes[deckId] = deck;
  }
  return { completes };
}

function mergeSpeeddrill(a: unknown, b: unknown): SpeeddrillData {
  return {
    best: Math.max(asInt(asDict(a).best), asInt(asDict(b).best)),
    plays: Math.max(asInt(asDict(a).plays), asInt(asDict(b).plays)),
  };
}

/** UTC calendar day of a Date (the streak dayKey format). */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayDistance(dayA: string, dayB: string): number {
  const parse = (s: string) => {
    const t = Date.parse(`${s.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(t) ? null : t;
  };
  const ta = parse(dayA);
  const tb = parse(dayB);
  if (ta === null || tb === null) return 10 ** 6;
  return Math.round((tb - ta) / 86_400_000);
}

function mergeStreak(a: unknown, b: unknown): StreakDataSynced {
  const ra = asDict(a);
  const rb = asDict(b);
  const lastA = typeof ra.lastDay === 'string' ? ra.lastDay : '';
  const lastB = typeof rb.lastDay === 'string' ? rb.lastDay : '';
  const best = Math.max(asInt(ra.best), asInt(rb.best));
  const totalDays = Math.max(asInt(ra.totalDays), asInt(rb.totalDays));

  /* The most recent visit carries the live chain ("recomputed from the
     last-visit date"); empty/absent days are missing and cannot win; same-day
     visits: the longer live chain wins. Symmetric by design. */
  const validA = dayDistance(lastA, lastA) === 0 && lastA.length === 10;
  const validB = dayDistance(lastB, lastB) === 0 && lastB.length === 10;
  const later = (() => {
    if (!validA && !validB) return 'none' as const;
    if (!validB) return 'a' as const;
    if (!validA) return 'b' as const;
    const diff = dayDistance(lastA, lastB); // positive → B is later
    if (diff > 0) return 'b' as const;
    if (diff < 0) return 'a' as const;
    return 'tie' as const;
  })();
  if (later === 'none') {
    return { lastDay: '', current: Math.max(asInt(ra.current), asInt(rb.current)), best, totalDays };
  }
  if (later === 'a') {
    return { lastDay: lastA, current: asInt(ra.current), best, totalDays };
  }
  if (later === 'b') {
    return { lastDay: lastB, current: asInt(rb.current), best, totalDays };
  }
  return {
    lastDay: lastB || lastA,
    current: Math.max(asInt(ra.current), asInt(rb.current)),
    best,
    totalDays,
  };
}

const MERGERS: Record<ProgressKey, (a: unknown, b: unknown) => ProgressPayload> = {
  learning: mergeLearning,
  terminal: mergeTerminal,
  flashcards: mergeFlashcards,
  speeddrill: mergeSpeeddrill,
  streak: mergeStreak,
};

/** Deterministic merge of two payloads for `key`. Never throws on junk input. */
export function mergeProgressData(key: ProgressKey, a: unknown, b: unknown): ProgressPayload {
  return MERGERS[key](a, b);
}

/* ------------------------------------------------- local blob → payload */

/**
 * Extract the synced payload subset from a page-local storage blob.
 * Device-local concerns (terminal lines/history, flashcards lastDeck) are
 * deliberately NOT part of the synced payload — Part 2 keeps the terminal
 * scrollback local-only.
 */
export function toSyncPayload(key: ProgressKey, blob: unknown): ProgressPayload | null {
  if (!isDict(blob)) return null;
  switch (key) {
    case 'learning': {
      const out: LearningData = {};
      for (const [pathId, entry] of Object.entries(blob as Record<string, unknown>)) {
        const e = asDict(entry);
        out[pathId] = {
          completed: e.completed === true,
          bestScore: Math.max(0, asInt(e.bestScore)),
          bestTotal: Math.max(0, asInt(e.bestTotal)),
          lessons: Array.from(new Set(asList(e.lessons).map(String))).sort().slice(0, 200),
        };
      }
      return out;
    }
    case 'terminal': {
      const solved = Array.from(new Set(asList(blob.solved).map(String))).filter((id) => /^m\d{1,2}$/.test(id)).sort().slice(0, 64);
      return { solved, commandsRun: Math.max(0, asInt(blob.commandsRun)) };
    }
    case 'flashcards': {
      const completes: Record<string, number> = {};
      for (const [deckId, count] of Object.entries(asDict(blob.completes))) {
        const c = asInt(count);
        if (c > 0) completes[deckId] = Math.min(c, 6400);
      }
      return { completes };
    }
    case 'speeddrill':
      return { best: Math.max(0, asInt(blob.best)), plays: Math.max(0, asInt(blob.plays)) };
    case 'streak': {
      const lastDay = typeof blob.lastDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(blob.lastDay) ? blob.lastDay : dayKey(new Date());
      const current = Math.max(0, asInt(blob.current));
      const best = Math.max(current, asInt(blob.best));
      return { lastDay, current, best, totalDays: Math.max(asInt(blob.totalDays), 1) };
    }
  }
}

/* ------------------------------------------------------- per-user cache */

/** Offline cache shape: the device's merged end-state per key + server versions. */
export type ProgressCache = {
  version: 1;
  versions: Partial<Record<ProgressKey, number>>;
  data: Partial<Record<ProgressKey, ProgressPayload>>;
};

const progressCacheKey = (userId: number) => `linuxdocs.progress-v1-u${userId}`;

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
    /* storage full or blocked — offline cache degrades, nothing crashes */
  }
};

export const removeLS = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export function emptyProgressCache(): ProgressCache {
  return { version: 1, versions: {}, data: {} };
}

function cacheLooksValid(v: unknown): v is ProgressCache {
  return isDict(v) && v.version === 1 && isDict(v.versions) && isDict(v.data);
}

export function loadProgressCache(userId: number): ProgressCache {
  const parsed = JSON.parse(readLS(progressCacheKey(userId)) ?? 'null');
  return cacheLooksValid(parsed) ? (parsed as ProgressCache) : emptyProgressCache();
}

export function saveProgressCache(userId: number, cache: ProgressCache) {
  writeLS(progressCacheKey(userId), JSON.stringify(cache));
}

/* ------------------------------------------------ legacy (pre-Part 2) keys */

/**
 * localStorage keys written by every build BEFORE Part 2. Their content was
 * device-local progress; on the first boot after the upgrade the signed-in
 * user absorbs them into the per-user cache and the old keys go away for
 * good. (One-time adoption by whichever account signs in first — the same
 * honest convention as the pre-Part-1 guest-store absorption.)
 */
export const LEGACY_PROGRESS_STORES: Partial<Record<ProgressKey, string>> = {
  learning: 'linuxdocs.learning-progress-v3',
  terminal: 'linuxdocs.practice-terminal',
  flashcards: 'linuxdocs.flashcards',
  speeddrill: 'linuxdocs.speeddrill',
  streak: 'linuxdocs.streak',
};

/* ---------------------------------------------- queue ⇄ provider bridge */

/**
 * Decoupling shim: the sync queue (AuthContext) resolves PUT-409 conflicts by
 * merging against the current device end-state and re-PUTting; when it does,
 * the ProgressProvider learns the new state through this hook. A module-level
 * registry keeps AuthContext ⇄ ProgressContext free of circular imports.
 */
export const progressIntegration: {
  /** provider-registered: receives merged (key, payload, version) updates */
  onMerged: null | ((key: ProgressKey, payload: ProgressPayload, version: number) => void);
} = { onMerged: null };
