/* eslint-disable */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Bookmark, Layers, RotateCcw, Shield, Shuffle, Terminal,
  X, CheckCircle2, GraduationCap,
} from 'lucide-react';
import type { Command, CommandLight } from '../types';
import { getPathForLight, useCatalog, useCommandDocs } from '../context/CatalogContext';
import { useAuth } from '../context/AuthContext';

/* ============================================================
   Flashcards: deck study mode over the authed catalog (Part 1).
   Decks = all Linux, per category, all CTF, per domain, bookmarks.
   Deck tiles are built from the light index; the session fetches
   the full docs for its slugs on demand (in-memory cache + ETag).
   Flip cards, mark got it / again, session summary at the end.
   ============================================================ */

type Deck = { id: string; title: string; blurb: string; accent: 'linux' | 'ctf'; lights: CommandLight[] };

type FlashcardStore = { lastDeck: string | null; completes: Record<string, number> };
const STORE_KEY = 'linuxdocs.flashcards';

function loadStore(): FlashcardStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as FlashcardStore;
      if (parsed && typeof parsed.completes === 'object') return { lastDeck: parsed.lastDeck ?? null, completes: parsed.completes ?? {} };
    }
  } catch {
    /* corrupted storage - start fresh */
  }
  return { lastDeck: null, completes: {} };
}

function saveStore(next: FlashcardStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardsPage() {
  const { bookmarks } = useAuth();
  const { lights, categories, domains } = useCatalog();
  const [storeState, setStoreState] = useState<FlashcardStore>(loadStore);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  const decks = useMemo<Deck[]>(() => {
    const lightIn = (section: 'linux' | 'ctf', category?: string) =>
      lights.filter((c) => c.section === section && (!category || c.category === category));

    const linuxDeck: Deck = {
      id: 'linux',
      title: 'All Linux utilities',
      blurb: 'The full collection, shuffled - great as a daily warm-up.',
      accent: 'linux',
      lights: lightIn('linux'),
    };
    const categoryDecks = categories
      .filter((category) => category.section === 'linux')
      .map((category) => ({
        id: `linux:${category.id}`,
        title: category.name,
        blurb: category.description,
        accent: 'linux' as const,
        lights: lightIn('linux', category.id),
      })).filter((deck) => deck.lights.length > 0);

    const ctfDeck: Deck = {
      id: 'ctf',
      title: 'All CTF & security tools',
      blurb: 'Every offensive toolkit command in one shuffled deck.',
      accent: 'ctf',
      lights: lightIn('ctf'),
    };
    const domainDecks = domains.map((domain) => ({
      id: `ctf:${domain.id}`,
      title: domain.name,
      blurb: domain.description,
      accent: 'ctf' as const,
      lights: lightIn('ctf', domain.id),
    })).filter((deck) => deck.lights.length > 0);

    const lightBySlug = new Map(lights.map((light) => [light.slug, light]));
    const bookmarkCommands = Array.from(bookmarks)
      .map((slug) => lightBySlug.get(slug))
      .filter((light): light is CommandLight => Boolean(light));
    const bookmarkDeck: Deck | null = bookmarkCommands.length
      ? {
          id: 'bookmarks',
          title: 'Your bookmarks',
          blurb: 'The commands you starred - the ones you clearly care about.',
          accent: 'linux',
          lights: bookmarkCommands,
        }
      : null;

    return [linuxDeck, ...categoryDecks, ctfDeck, ...domainDecks, ...(bookmarkDeck ? [bookmarkDeck] : [])];
  }, [bookmarks, lights, categories, domains]);

  const activeDeck = activeDeckId ? decks.find((deck) => deck.id === activeDeckId) ?? null : null;

  const openDeck = (deckId: string) => {
    const next: FlashcardStore = { ...storeState, lastDeck: deckId, completes: { ...storeState.completes } };
    setStoreState(next);
    saveStore(next);
    setActiveDeckId(deckId);
  };

  const recordComplete = (deckId: string) => {
    const completes = { ...storeState.completes, [deckId]: (storeState.completes[deckId] ?? 0) + 1 };
    const next: FlashcardStore = { ...storeState, completes };
    setStoreState(next);
    saveStore(next);
  };

  const lastDeck = storeState.lastDeck ? decks.find((deck) => deck.id === storeState.lastDeck) ?? null : null;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        {/* ---------------- header ---------------- */}
        <header className="mb-8">
          <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-[var(--terminal-green)]">
            <Layers className="h-3.5 w-3.5" /> ~/flashcards
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Flashcards</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">
            Pick a deck, flip through it, and mark what stuck. front: the command name. back: what it does, its syntax and the flags
            that matter. Tip: the bookmarks deck drills the commands you starred.
          </p>
        </header>

        {activeDeck ? (
          <FlashcardSession
            key={activeDeck.id}
            deck={activeDeck}
            completes={storeState.completes[activeDeck.id] ?? 0}
            onExit={() => setActiveDeckId(null)}
            onRestartCompleted={() => recordComplete(activeDeck.id)}
          />
        ) : (
          <DecksView decks={decks} lastDeck={lastDeck} completes={storeState.completes} onOpen={openDeck} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Decks grid
   ============================================================ */

function DecksView({
  decks,
  lastDeck,
  completes,
  onOpen,
}: {
  decks: Deck[];
  lastDeck: Deck | null;
  completes: Record<string, number>;
  onOpen: (deckId: string) => void;
}) {
  return (
    <div className="space-y-6">
      {lastDeck && (
        <button
          onClick={() => onOpen(lastDeck.id)}
          className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/5 px-4 py-3 text-left transition-colors hover:bg-[var(--terminal-green)]/10"
        >
          <RotateCcw className="h-4 w-4 shrink-0 text-[var(--terminal-green)]" />
          <span className="text-sm">
            Continue <span className="font-semibold">{lastDeck.title}</span>
            {completes[lastDeck.id] ? <span className="text-[var(--text-muted)]"> · {completes[lastDeck.id]} session{completes[lastDeck.id] === 1 ? '' : 's'} done</span> : null}
          </span>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[var(--terminal-green)]" />
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((deck) => {
          const isCTF = deck.accent === 'ctf';
          const sessions = completes[deck.id] ?? 0;
          return (
            <button
              key={deck.id}
              onClick={() => onOpen(deck.id)}
              className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--text-muted)]/40"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isCTF ? 'bg-[var(--ctf-red)]/10 text-[var(--ctf-red)]' : 'bg-[var(--terminal-green)]/10 text-[var(--terminal-green)]'
                  }`}
                >
                  {deck.id === 'bookmarks' ? (
                    <Bookmark className="h-5 w-5" />
                  ) : deck.id === 'linux' ? (
                    <Terminal className="h-5 w-5" />
                  ) : deck.id === 'ctf' ? (
                    <Shield className="h-5 w-5" />
                  ) : isCTF ? (
                    <Shield className="h-5 w-5" />
                  ) : (
                    <GraduationCap className="h-5 w-5" />
                  )}
                </span>
                <span className="font-mono text-xs text-[var(--text-muted)]">{deck.lights.length} cards</span>
              </div>
              <h3 className="mt-3 text-base font-bold leading-snug">{deck.title}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-[var(--text-muted)]">{deck.blurb}</p>
              <span className="mt-3 font-mono text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                {sessions > 0 ? `${sessions} session${sessions === 1 ? '' : 's'} complete` : 'not studied yet'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Study session — loads the deck's full docs before the first flip
   ============================================================ */

function FlashcardSession({
  deck,
  completes,
  onExit,
  onRestartCompleted,
}: {
  deck: Deck;
  completes: number;
  onExit: () => void;
  onRestartCompleted: () => void;
}) {
  type Mark = 'ok' | 'again';
  // The session fetches this deck's full docs on demand (cached per session).
  const deckSlugs = useMemo(() => deck.lights.map((light) => light.slug), [deck.lights]);
  const { docs, error: docsError } = useCommandDocs(deckSlugs);
  const loaded = docs.length > 0 && docs.length === deckSlugs.length;

  const [cards, setCards] = useState<Command[]>([]);
  const [useShuffle, setUseShuffle] = useState(true);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  const card = cards[index];
  const finished = loaded && index >= cards.length;
  const okCount = Object.entries(marks).filter(([, mark]) => mark === 'ok').length;
  const againCount = cards.filter((c) => marks[c.slug] === 'again').length;
  const isCTF = deck.accent === 'ctf';
  const accentText = isCTF ? 'text-[var(--ctf-red)]' : 'text-[var(--terminal-green)]';
  const accentBorder = isCTF ? 'border-[var(--ctf-red)]/50' : 'border-[var(--terminal-green)]/50';

  /* first deal: as soon as the docs wave lands, shuffle into session order */
  useEffect(() => {
    if (loaded && cards.length === 0) {
      setCards(shuffled(docs));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, docs]);

  const restart = useCallback(
    (shuffle: boolean) => {
      setUseShuffle(shuffle);
      setCards(shuffle ? shuffled(docs) : [...docs]);
      setIndex(0);
      setFlipped(false);
      setMarks({});
    },
    [docs],
  );

  /* completion is recorded once per finished session */
  const recordedRef = useMemo(() => ({ done: false }), []);
  useEffect(() => {
    if (finished && !recordedRef.done) {
      recordedRef.done = true;
      onRestartCompleted();
    }
  }, [finished, onRestartCompleted, recordedRef]);

  const mark = useCallback(
    (kind: Mark) => {
      if (!card) return;
      setMarks((current) => ({ ...current, [card.slug]: kind }));
      setIndex((current) => current + 1);
      setFlipped(false);
    },
    [card],
  );

  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((current) => Math.min(current + 1, cards.length));
  }, [cards.length]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  /* keyboard: space flip, arrows navigate, G/A mark */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      const key = event.key.toLowerCase();
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (finished) return;
        setFlipped((prev) => !prev);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (key === 'g' && !finished) {
        event.preventDefault();
        mark('ok');
      } else if (key === 'x' && !finished) {
        event.preventDefault();
        mark('again');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, goNext, goPrev, mark]);

  if (docsError) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All decks
          </button>
        </div>
        <div className="rounded-2xl border border-[var(--ctf-red)]/40 bg-[var(--surface)] p-10 text-center">
          <p className="font-mono text-sm text-[var(--ctf-red)]">{docsError}</p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">The deck's cards could not be loaded.</p>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All decks
          </button>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <p className="font-mono text-sm text-[var(--text-muted)]">
            dealing {deck.lights.length} cards<span className="blinking">_</span>
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">fetching documentation for this deck…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* session top bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All decks
        </button>
        <p className="font-mono text-xs text-[var(--text-muted)]">
          <span className={accentText}>{deck.title}</span> · {completes} earlier session{completes === 1 ? '' : 's'} ·{' '}
          <span className="hidden sm:inline">space flips · G got it · X again</span>
          <span className="sm:hidden">tap card to flip</span>
        </p>
        <button
          onClick={() => restart(!useShuffle)}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
          title={useShuffle ? 'Restart in dataset order' : 'Restart shuffled'}
        >
          {useShuffle ? <Shuffle className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {useShuffle ? 'Shuffled' : 'In order'}
        </button>
      </div>

      {finished && cards.length > 0 ? (
        <SessionSummary
          deck={deck}
          total={cards.length}
          okCount={okCount}
          marks={marks}
          onRestart={restart}
          onExit={onExit}
        />
      ) : (
        <>
          {/* progress segment strip */}
          <div className="mb-4 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            {cards.map((entry, dot) => {
              const value = marks[entry.slug];
              const isCurrent = dot === index;
              return (
                <span
                  key={entry.slug + dot}
                  className={`h-full flex-1 ${
                    isCurrent
                      ? 'bg-[var(--text-heading)]'
                      : value === 'ok'
                        ? 'bg-emerald-400'
                        : value === 'again'
                          ? 'bg-rose-400'
                          : 'bg-[var(--border)]'
                  }`}
                />
              );
            })}
          </div>

          {/* card */}
          <button
            type="button"
            onClick={() => setFlipped((prev) => !prev)}
            aria-live="polite"
            className={`relative block min-h-[380px] w-full cursor-pointer rounded-2xl border-2 bg-[var(--surface)] p-6 text-left transition-colors sm:min-h-[420px] sm:p-8 ${accentBorder} ${
              flipped ? 'bg-[var(--bg-surface)]' : ''
            }`}
          >
            <span className="absolute left-5 top-5 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">
              {isCTF ? 'ctf · ' : 'linux · '}
              {card?.category}
              <span className="ml-2">{flipped ? '(back)' : '(front)'}</span>
            </span>
            <span className="absolute right-5 top-5 font-mono text-xs text-[var(--text-muted)]">
              {index + 1}/{cards.length}
            </span>

            {!flipped ? (
              <div className="flex h-[300px] flex-col items-center justify-center gap-4 sm:h-[330px]">
                <code className={`font-mono text-4xl font-bold sm:text-5xl ${accentText}`}>{card?.name}</code>
                <div className="flex flex-wrap justify-center gap-2">
                  {card?.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full bg-[var(--border)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">click to flip · what does it do?</span>
              </div>
            ) : (
              <div className="flex h-[300px] flex-col gap-3 overflow-y-auto sm:h-[330px]">
                <p className="text-base font-semibold sm:text-lg">{card?.summary}</p>
                <pre className="whitespace-pre-wrap rounded-lg bg-[var(--code-bg)] px-3 py-2 font-mono text-sm text-[var(--terminal-green)]">
                  {card?.syntax}
                </pre>
                <div className="flex flex-wrap gap-2">
                  {card?.options.slice(0, 5).map((option) => (
                    <span key={option.flag} className="rounded-md border border-[var(--border)] px-2 py-1 font-mono text-xs text-[var(--text)]">
                      {option.flag}
                    </span>
                  ))}
                  {(card?.options.length ?? 0) > 5 && (
                    <span className="px-1 py-1 font-mono text-xs text-[var(--text-muted)]">+{(card?.options.length ?? 0) - 5} more flags</span>
                  )}
                </div>
                {card?.examples[0] && (
                  <p className="truncate font-mono text-xs text-[var(--text-muted)]">
                    <span className="text-[var(--terminal-green)]">$ </span>
                    {card.examples[0].command}
                  </p>
                )}
                {card?.warnings && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-400">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {card.warnings}
                  </p>
                )}
                {card && (
                  <Link
                    to={getPathForLight(card)}
                    onClick={(event) => event.stopPropagation()}
                    className={`mt-auto inline-flex items-center gap-1.5 font-mono text-xs hover:underline ${accentText}`}
                  >
                    Open full documentation <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
          </button>

          {/* controls */}
          {flipped ? (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => mark('again')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-400/50 px-4 py-3 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-400/10"
              >
                <X className="h-4 w-4" /> Again <span className="font-mono text-[10px] opacity-60">X</span>
              </button>
              <button
                onClick={() => mark('ok')}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
              >
                <CheckCircle2 className="h-4 w-4" /> Got it <span className="font-mono text-[10px] opacity-60">G</span>
              </button>
            </div>
          ) : (
            <div className="mt-4 flex gap-3">
              <button
                onClick={goPrev}
                disabled={index === 0}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition-colors enabled:hover:border-[var(--terminal-green)] disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Previous
              </button>
              <button
                onClick={() => setFlipped(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--terminal-green)] px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
              >
                Flip card
              </button>
              <button
                onClick={goNext}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition-colors hover:border-[var(--terminal-green)]"
              >
                Next <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* running tallies */}
          <p className="mt-4 text-center font-mono text-xs text-[var(--text-muted)]">
            got it {okCount} · to revisit {againCount} · remaining {cards.length - Object.keys(marks).length}
          </p>
        </>
      )}
    </div>
  );
}

/* ============================================================
   End-of-deck summary
   ============================================================ */

function SessionSummary({
  deck,
  total,
  okCount,
  marks,
  onRestart,
  onExit,
}: {
  deck: Deck;
  total: number;
  okCount: number;
  marks: Record<string, 'ok' | 'again'>;
  onRestart: (shuffle: boolean) => void;
  onExit: () => void;
}) {
  const { lights } = useCatalog();
  const lightBySlug = useMemo(() => new Map(lights.map((light) => [light.slug, light])), [lights]);
  const pct = total ? Math.round((okCount / total) * 100) : 0;
  const againCards = Object.entries(marks)
    .filter(([, mark]) => mark === 'again')
    .map(([slug]) => lightBySlug.get(slug))
    .filter((light): light is CommandLight => Boolean(light));
  const isCTF = deck.accent === 'ctf';

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-8">
      <GraduationCap className={`mx-auto h-10 w-10 ${isCTF ? 'text-[var(--ctf-red)]' : 'text-[var(--terminal-green)]'}`} />
      <h2 className="mt-3 text-2xl font-bold">Deck complete</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {okCount}/{total} got it · {pct}% retention
      </p>
      <div className="mx-auto mt-4 h-2 max-w-sm overflow-hidden rounded-full bg-[var(--border)]">
        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {againCards.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-left">
          <p className="font-mono text-[11px] uppercase tracking-wider text-amber-400">Marked for revisit · {againCards.length}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {againCards.map((light) => (
              <Link
                key={light.slug}
                to={getPathForLight(light)}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-xs text-[var(--text)] transition-colors hover:text-[var(--text-heading)]"
              >
                {light.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => onRestart(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
        >
          <Shuffle className="h-4 w-4" /> Run deck again
        </button>
        <button
          onClick={onExit}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--terminal-green)]"
        >
          <ArrowLeft className="h-4 w-4" /> Pick another deck
        </button>
      </div>
    </div>
  );
}

export default FlashcardsPage;
