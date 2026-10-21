/**
 * User-data sync state machine — the single source of truth for the Dashboard
 * sync chip and for the offline retry queue semantics.
 *
 * PHASE RULES (the contract the UI relies on):
 * - 'synced' may ONLY be entered from a handler that received a 2xx from the
 *   server (`markSynced` is called at those sites). It is never a local guess,
 *   so the chip can never claim "Synced" before the server confirmed.
 * - 'saved-local' means the change was applied locally and is queued for
 *   delivery (offline, 5xx, or rate-limited). The queue persists across
 *   reloads and drains with exponential backoff.
 * - 'saving' = a request is currently in flight.
 * - 'failed' = the server permanently rejected a change (4xx). The local
 *   change is reverted and the reason is surfaced.
 * - 'idle' = nothing to deliver; everything the user did is on the server.
 */

export type SyncPhase = 'idle' | 'saving' | 'synced' | 'saved-local' | 'failed';

export interface SyncState {
  phase: SyncPhase;
  /** epoch ms of the last phase change */
  at: number;
  /** optional human hint, e.g. pending-change count or a server error string */
  detail?: string;
}

export const INITIAL_SYNC_STATE: SyncState = { phase: 'idle', at: 0 };

const now = () => Date.now();

export const markIdle = (detail?: string): SyncState => ({ phase: 'idle', at: now(), detail });
export const markSaving = (detail?: string): SyncState => ({ phase: 'saving', at: now(), detail });
/** Call ONLY after a 2xx server response for the relevant request. */
export const markSynced = (detail?: string): SyncState => ({ phase: 'synced', at: now(), detail });
export const markSavedLocal = (detail?: string): SyncState => ({ phase: 'saved-local', at: now(), detail });
export const markFailed = (detail?: string): SyncState => ({ phase: 'failed', at: now(), detail });

export function syncLabel(state: SyncState): string {
  switch (state.phase) {
    case 'saving':
      return 'Syncing…';
    case 'synced':
      return state.at ? `Synced · ${new Date(state.at).toLocaleTimeString()}` : 'Synced';
    case 'saved-local': {
      const n = state.detail ? ` (${state.detail})` : '';
      return `Saved locally${n} — syncs automatically`;
    }
    case 'failed':
      return `Sync failed${state.detail ? ` — ${state.detail}` : ''}`;
    default:
      return 'All changes saved';
  }
}

/** Exponential backoff: 1 s, 2 s, 4 s, 8 s, 16 s … capped at 60 s. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.max(0, attempt));
}

/* ---------------------------------------------------------------------------
 * Persistent operation queue
 *
 * Ops describe the DESIRED END STATE per (kind, slug) — not deltas. Two quick
 * bookmark toggles collapse to one op that matches what the user last wanted,
 * so replays are idempotent and can never flip-flop out of order.
 * ------------------------------------------------------------------------- */

export type SyncOp =
  | { id: number; kind: 'bookmark'; slug: string; wanted: boolean; userId: number }
  | { id: number; kind: 'note-set'; slug: string; text: string; userId: number }
  | { id: number; kind: 'note-del'; slug: string; userId: number }
  | { id: number; kind: 'history'; slug: string; userId: number };

export const QUEUE_VERSION = 1;
export const MAX_QUEUE_ITEMS = 500;

export interface QueueFile {
  version: number;
  ops: SyncOp[];
}

/** Collapse + append. Returns a NEW array; the original is untouched. */
export function enqueueOp(ops: SyncOp[], op: SyncOp): SyncOp[] {
  const collapseKey = (o: SyncOp) => (o.kind === 'history' ? `${o.kind}:${o.slug}` : `${o.kind}:${o.slug}`);
  const key = collapseKey(op);
  const next = ops.filter((o) => collapseKey(o) !== key);
  next.push(op);
  if (next.length > MAX_QUEUE_ITEMS) next.splice(0, next.length - MAX_QUEUE_ITEMS);
  return next;
}

/**
 * Deterministic merge policy, documented here as the code that enforces it:
 *
 * At sign-in, guest-mode records are converted into queued ops and replayed as
 * ordinary server upserts. Guest-side records therefore WIN for exactly the
 * records the guest touched; anything already on the server that the guest
 * never created or changed is preserved as-is. Replays are idempotent
 * (bookmark toggle → explicit wanted state; note upsert → deterministic
 * final text; history → server-side dedupe by slug), so a crash between
 * conversion and delivery cannot corrupt or duplicate anything.
 */
export function guestOpsFromStore(
  store: GuestStore,
  userId: number,
  nextId: () => number,
): SyncOp[] {
  const ops: SyncOp[] = [];
  for (const b of store.bookmarks) {
    ops.push({ id: nextId(), kind: 'bookmark', slug: b.slug, wanted: true, userId });
  }
  for (const n of store.notes) {
    ops.push({ id: nextId(), kind: 'note-set', slug: n.command_slug, text: n.text, userId });
  }
  for (const h of store.history.slice(0, 15)) {
    ops.push({ id: nextId(), kind: 'history', slug: h.command_slug, userId });
  }
  return ops;
}

/* ---------------------------------------------------------------------------
 * Guest mode store — bookmarks/notes/history before there is an account.
 * --------------------------------------------------------------------------- */

export const GUEST_STORE_VERSION = 1;

export interface GuestBookmark { slug: string; saved_at: string }
export interface GuestNote { command_slug: string; text: string; saved_at: string }
export interface GuestHistory { command_slug: string; viewed_at: string }

export interface GuestStore {
  version: number;
  bookmarks: GuestBookmark[];
  notes: GuestNote[];
  history: GuestHistory[];
}

export const EMPTY_GUEST_STORE: GuestStore = { version: GUEST_STORE_VERSION, bookmarks: [], notes: [], history: [] };

export function emptyGuestStore(): GuestStore {
  return { ...EMPTY_GUEST_STORE, bookmarks: [], notes: [], history: [] };
}

/*--------------------------- storage round-trips -------------------------- */

export function safeParseJson<T>(raw: string | null, validate: (v: unknown) => v is T): T | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isSyncOp(v: unknown): v is SyncOp {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== 'number' || typeof o.kind !== 'string' || typeof o.slug !== 'string' || typeof o.userId !== 'number') {
    return false;
  }
  switch (o.kind) {
    case 'bookmark':
      return typeof (o as { wanted?: unknown }).wanted === 'boolean';
    case 'note-set':
      return typeof (o as { text?: unknown }).text === 'string';
    case 'note-del':
    case 'history':
      return true;
    default:
      return false;
  }
}

export function isQueueFile(v: unknown): v is QueueFile {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.version === QUEUE_VERSION
    && Array.isArray(o.ops)
    && o.ops.every(isSyncOp);
}

export function isGuestStore(v: unknown): v is GuestStore {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.version === GUEST_STORE_VERSION
    && Array.isArray(o.bookmarks)
    && Array.isArray(o.notes)
    && Array.isArray(o.history)
    && o.bookmarks.every((b: unknown) => !!(b && typeof b === 'object' && typeof (b as GuestBookmark).slug === 'string'))
    && o.notes.every((n: unknown) => !!(n && typeof n === 'object' && typeof (n as GuestNote).command_slug === 'string' && typeof (n as GuestNote).text === 'string'))
    && o.history.every((h: unknown) => !!(h && typeof h === 'object' && typeof (h as GuestHistory).command_slug === 'string'));
}
