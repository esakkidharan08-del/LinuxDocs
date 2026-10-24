/* ============================================================
   Spaced repetition scheduling (Leitner buckets, "SM-2-lite").

   Piece of the synced flashcards progress payload (v2): each
   marked card carries { bucket, due }. Rules:

     • "Got it"  — bucket + 1 (capped), due shifts by INTERVALS[bucket-1]
     • "Again"   — bucket reset to 0, due tomorrow (relearn)
     • never reviewed — treated as bucket 0 due (due today)
     • bucket 8 after "Got it" → the card is a candidate for
       retirement ~180 days out and simply pauses until then.

   Dates are UTC calendar days (`YYYY-MM-DD`), same format the
   streak merge and the SRS schema validation both pin down.
   ============================================================ */

import type { SrsCard } from './progress';

export const SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180] as const;

/** UTC calendar day of a Date (the shared dayKey format). */
export function srsDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function srsAddDays(day: string, days: number): string {
  const base = Date.parse(`${day.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(base)) return srsDayKey(new Date());
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** A card is due when its due day has arrived (or is overdue). */
export function srsIsDue(entry: SrsCard | undefined, today: string): boolean {
  if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(entry.due)) return false;
  return entry.due <= today;
}

/** The next review state after marking a card in a session. */
export function srsNext(entry: SrsCard | undefined, mark: 'ok' | 'again', today: string): SrsCard {
  if (mark === 'again') return { bucket: 0, due: srsAddDays(today, 1) };
  const max = SRS_INTERVALS.length; // 8 — mirrors backend MAX_SRS_BUCKET
  const bucket = Math.min((entry?.bucket ?? 0) + 1, max);
  return { bucket, due: srsAddDays(today, SRS_INTERVALS[bucket - 1]) };
}

/** Days from `today` until the card comes due (0 = due now). */
export function srsDaysUntil(entry: SrsCard, today: string): number {
  const from = Date.parse(`${today.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${entry.due.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return 10 ** 6;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}
