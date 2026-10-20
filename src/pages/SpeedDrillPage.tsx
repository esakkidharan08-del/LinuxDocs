/* eslint-disable */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, GraduationCap, RotateCcw, Target, Trophy, Zap, ArrowRight } from 'lucide-react';
import { COMMANDS } from '../data/commands';

/* ============================================================
   Speed Drill - a 60 second rapid quiz generated from the dataset.
   No hand-written content: every round invents fresh questions from
   the summary, flags and descriptions of the 132 real commands.
   ============================================================ */

type Drill = { prompt: string; tag: string; options: string[]; answer: number };
type DrillStore = { best: number; plays: number };
const STORE_KEY = 'linuxdocs.speeddrill';
const ROUND_SECONDS = 60;

function loadStore(): DrillStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DrillStore;
      if (parsed && typeof parsed.best === 'number') return { best: parsed.best, plays: parsed.plays ?? 0 };
    }
  } catch {
    /* corrupted storage - start fresh */
  }
  return { best: 0, plays: 0 };
}

function saveStore(next: DrillStore) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
}

function randItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const WITH_OPTIONS = COMMANDS.filter((c) => c.options.length >= 2);
const ALL_NAMES = COMMANDS.map((c) => c.name);
const ALL_SUMMARIES = Array.from(new Set(COMMANDS.map((c) => c.summary)));
const ALL_FLAG_DESCRIPTIONS = Array.from(new Set(COMMANDS.flatMap((c) => c.options.map((o) => o.description))));

/** Build distinct distractors from a pool, excluding the answer text itself. */
function distractors(pool: string[], answer: string, count: number): string[] {
  const picked = new Set<string>();
  for (let guard = 0; guard < count * 40 && picked.size < count; guard += 1) {
    const candidate = randItem(pool);
    if (candidate && candidate !== answer && !picked.has(candidate)) picked.add(candidate);
  }
  return Array.from(picked);
}

/** options[0] must be the correct answer; it gets shuffled into place here. */
function finalize(prompt: string, tag: string, correctFirst: string[]): Drill {
  const correct = correctFirst[0].replace(/\s+/g, ' ').trim();
  const options = [correct, ...correctFirst.slice(1).map((text) => text.replace(/\s+/g, ' ').trim())].slice(0, 4);
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return { prompt, tag, options: shuffled, answer: shuffled.indexOf(correct) };
}

function buildQuestion(): Drill {
  const kind = randItem(['flag-purpose', 'command-summary', 'summary-command', 'flag-name']);

  if (kind === 'flag-purpose' && WITH_OPTIONS.length > 0) {
    const command = randItem(WITH_OPTIONS);
    const option = randItem(command.options);
    const distractorsFound = distractors(
      ALL_FLAG_DESCRIPTIONS.filter((d) => d !== option.description),
      option.description,
      3,
    );
    if (distractorsFound.length === 3) {
      return finalize(`${command.name}, what does ${option.flag} do?`, 'flag · purpose', [option.description, ...distractorsFound]);
    }
  }

  if (kind === 'flag-name' && WITH_OPTIONS.length > 0) {
    const command = randItem(WITH_OPTIONS);
    const option = randItem(command.options);
    const wrongFlags = command.options.filter((o) => o.flag !== option.flag).map((o) => o.flag);
    const otherFlags = distractors(
      WITH_OPTIONS.flatMap((c) => c.options.map((o) => o.flag)).filter((f) => !wrongFlags.includes(f)),
      option.flag,
      3,
    );
    if (otherFlags.length === 3) {
      return finalize(`In ${command.name}, which flag means "${option.description}"?`, 'purpose · flag', [option.flag, ...otherFlags]);
    }
  }

  if (kind === 'summary-command') {
    const command = randItem(COMMANDS);
    const others = distractors(
      ALL_NAMES.filter((n) => n !== command.name),
      command.name,
      3,
    );
    if (others.length === 3) {
      return finalize(`Which command matches: "${command.summary}"`, 'summary · command', [command.name, ...others]);
    }
  }

  /* fallback + 'command-summary' path */
  const command = randItem(COMMANDS);
  const others = distractors(
    ALL_SUMMARIES.filter((s) => s !== command.summary),
    command.summary,
    3,
  );
  if (others.length < 3) {
    /* guaranteed-valid shape for a 132-command dataset */
    return finalize(`What does ${command.name} do?`, 'command · summary', [
      command.summary,
      'Reboots the system without confirmation.',
      'Prints the kernel ring buffer.',
      'Renames the current shell session.',
    ]);
  }
  return finalize(`What does ${command.name} do?`, 'command · summary', [command.summary, ...others]);
}

export function SpeedDrillPage() {
  const [store, setStore] = useState<DrillStore>(loadStore);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'done'>('idle');
  const [question, setQuestion] = useState<Drill | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);
  const [prevBest, setPrevBest] = useState(0);

  const answeredRef = useRef(false);
  const advanceTimer = useRef<number | undefined>(undefined);
  const savedRef = useRef(false);

  /* countdown */
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = window.setInterval(() => {
      setSecondsLeft((left) => {
        if (left <= 1) {
          window.clearInterval(interval);
          setPhase('done');
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  /* capture the old best, then persist the finished round exactly once */
  useEffect(() => {
    if (phase !== 'done') {
      savedRef.current = false;
      return;
    }
    if (savedRef.current) return;
    savedRef.current = true;
    setPrevBest(store.best);
    const next: DrillStore = { best: Math.max(store.best, score), plays: store.plays + 1 };
    setStore(next);
    saveStore(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => () => window.clearTimeout(advanceTimer.current), []);

  const answerWith = useCallback(
    (index: number) => {
      if (!question || answeredRef.current) return;
      answeredRef.current = true;
      setPicked(index);

      const isCorrect = index === question.answer;
      const nextCombo = isCorrect ? combo + 1 : 0;
      setCombo(nextCombo);
      setBestCombo((best) => Math.max(best, nextCombo));
      setAsked((value) => value + 1);
      if (isCorrect) {
        setCorrectCount((value) => value + 1);
        /* bonus point on every 3rd consecutive hit */
        setScore((value) => value + 1 + Math.floor(nextCombo / 3));
      }

      advanceTimer.current = window.setTimeout(
        () => {
          setPicked(null);
          answeredRef.current = false;
          setQuestion(buildQuestion());
        },
        isCorrect ? 320 : 900,
      );
    },
    [question, combo],
  );

  /* keyboard 1-4 answers */
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (event: KeyboardEvent) => {
      const index = ['1', '2', '3', '4'].indexOf(event.key);
      if (index >= 0) answerWith(index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, answerWith]);

  const start = () => {
    savedRef.current = false;
    setScore(0);
    setAsked(0);
    setCorrectCount(0);
    setCombo(0);
    setBestCombo(0);
    setSecondsLeft(ROUND_SECONDS);
    setPicked(null);
    answeredRef.current = false;
    setQuestion(buildQuestion());
    setPhase('playing');
  };

  const accuracy = asked ? Math.round((correctCount / asked) * 100) : 0;
  const isRecord = phase === 'done' && score > 0 && score > prevBest;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <header className="mb-8">
          <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-[var(--terminal-green)]">
            <Zap className="h-3.5 w-3.5" /> ~/speed-drill
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Speed Drill</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)] sm:text-base">
            Sixty seconds. Rapid-fire questions generated fresh from the entire command dataset each round. Answer with the mouse
            or keys 1-4 - every third consecutive hit earns a combo bonus point.
          </p>
        </header>

        {phase === 'idle' && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--terminal-green)]/10 px-3 py-1 font-mono text-xs text-[var(--terminal-green)]">
                <Trophy className="h-3.5 w-3.5" /> personal best: {store.best}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--text-muted)]">
                rounds played: {store.plays}
              </span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-[var(--text-muted)]">
              <li>• The quiz invents its own questions from real data - flag purposes, command summaries, name guessing.</li>
              <li>• Wrong answers cost nothing except time: a short red pause, then the drill moves on.</li>
              <li>• Combo rule: 3 hits in a row +1 bonus point, 6 in a row +2, and so on.</li>
            </ul>
            <button
              onClick={start}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--terminal-green)] px-6 py-3.5 text-base font-bold text-black transition-opacity hover:opacity-90 sm:w-auto"
            >
              <Zap className="h-5 w-5" /> Start 60-second drill
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-baseline gap-4 font-mono">
                <span className="text-sm text-[var(--text-muted)]">
                  score <span className="font-bold text-[var(--text-heading)]">{score}</span>
                </span>
                {combo >= 2 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
                    <Flame className="h-3.5 w-3.5" /> {combo + 1} combo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`font-mono text-3xl font-bold tabular-nums ${secondsLeft <= 10 ? 'text-rose-400' : 'text-[var(--text-heading)]'}`}
                  aria-live="polite"
                >
                  {secondsLeft}s
                </span>
                <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-[var(--border)] sm:block">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${secondsLeft <= 10 ? 'bg-rose-400' : 'bg-[var(--terminal-green)]'}`}
                    style={{ width: `${(secondsLeft / ROUND_SECONDS) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {question && (
              <>
                <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{question.tag}</p>
                <h2 className="text-xl font-semibold leading-snug sm:text-2xl">{question.prompt}</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, index) => {
                    const isAnswer = index === question.answer;
                    const isPicked = index === picked;
                    const revealed = picked !== null;
                    return (
                      <button
                        key={option}
                        onClick={() => answerWith(index)}
                        className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-sm leading-relaxed transition-colors ${
                          revealed && isAnswer
                            ? 'border-emerald-400 bg-emerald-400/10'
                            : revealed && isPicked
                              ? 'border-rose-400 bg-rose-400/10'
                              : revealed
                                ? 'border-[var(--border)] opacity-50'
                                : 'border-[var(--border)] hover:border-[var(--terminal-green)]'
                        }`}
                      >
                        <span className="font-mono text-xs text-[var(--text-muted)]">{index + 1}</span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-10">
            <Target className="mx-auto h-10 w-10 text-[var(--terminal-green)]" />
            <h2 className="mt-3 text-3xl font-bold">
              {score} <span className="text-lg font-medium text-[var(--text-muted)]">points</span>
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {asked} question{asked === 1 ? '' : 's'} · {accuracy}% accuracy · longest streak {bestCombo}
              {bestCombo >= 3 ? ' 🔥' : ''}
            </p>
            {isRecord && <p className="mt-2 font-mono text-sm font-bold text-amber-400">NEW PERSONAL BEST!</p>}
            {!isRecord && prevBest > 0 && (
              <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">Personal best: {store.best}</p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={start}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-5 py-2.5 text-sm font-bold text-black transition-opacity hover:opacity-90"
              >
                <RotateCcw className="h-4 w-4" /> Run it again
              </button>
              <Link
                to="/learn"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--terminal-green)]"
              >
                <GraduationCap className="h-4 w-4" /> Consolidate in paths
              </Link>
              <button
                onClick={() => setPhase('idle')}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition-colors hover:border-[var(--terminal-green)]"
              >
                <ArrowRight className="h-4 w-4" /> Overview
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SpeedDrillPage;
