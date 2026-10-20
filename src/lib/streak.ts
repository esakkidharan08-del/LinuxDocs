/* ============================================================
   Daily learning streak - persisted in localStorage.
   One row per day: visit today keeps/extends the streak, a missed
   day resets "current" while "best" is kept forever.
   ============================================================ */

const STORAGE_KEY = 'linuxdocs.streak';
const DAY_MS = 86400000;

export type StreakData = {
  /** ISO day (YYYY-MM-DD) of the most recent visit */
  lastDay: string;
  /** current streak length in days (0 if broken) */
  current: number;
  /** longest streak ever recorded */
  best: number;
  /** total distinct days visited */
  totalDays: number;
};

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function readStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StreakData;
      if (parsed && typeof parsed.current === 'number' && typeof parsed.best === 'number') {
        return normalizeStreak(parsed);
      }
    }
  } catch {
    /* corrupted storage - start fresh */
  }
  return { lastDay: '', current: 0, best: 0, totalDays: 0 };
}

/** Current streak is only alive if today or yesterday was the last visit day. */
export function normalizeStreak(data: StreakData): StreakData {
  const today = dayKey(new Date());
  if (data.lastDay === today) return data;
  const yesterday = dayKey(new Date(Date.now() - DAY_MS));
  if (data.lastDay !== yesterday) {
    return { ...data, current: 0 };
  }
  return data;
}

/** Record the current session. Safe to call on every app mount. */
export function recordVisit(): StreakData {
  const today = dayKey(new Date());
  const previous = readStreak();

  if (previous.lastDay === today) return previous;

  const yesterday = dayKey(new Date(Date.now() - DAY_MS));
  const next: StreakData =
    previous.lastDay === yesterday
      ? { ...previous, lastDay: today, current: previous.current + 1, totalDays: previous.totalDays + 1 }
      : { lastDay: today, current: 1, best: previous.best, totalDays: previous.totalDays + 1 };
  next.current = Math.max(next.current, 1);
  next.best = Math.max(next.best, next.current);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
  return next;
}

/** True when the user visited today - drives the lit flame color. */
export function isStreakLive(streak: StreakData): boolean {
  return streak.lastDay === dayKey(new Date());
}
