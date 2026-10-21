/* Practice-terminal UI. The interpreter, missions and sandbox filesystem live
   in src/lib/terminal.ts — a pure module the QA probe can also exercise
   (window.__linuxdocsTerminal in dev). Resource limits are enforced inside the
   module; this file caps the in-memory scrollback and the input element. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Lightbulb, Lock, RotateCcw, Target, Terminal, Trophy } from 'lucide-react';
import {
  ALL_LEVEL_IDS, HOME, MAX_INPUT_LENGTH, MAX_SCROLLBACK, MISSION_LEVELS, TOTAL_MISSIONS, WELCOME_GREETING,
  executeCommand, evaluateMissions, toneClass,
} from '../lib/terminal';
import type { Line, MissionLevel } from '../lib/terminal';

export { ALL_LEVEL_IDS, TOTAL_MISSIONS } from '../lib/terminal';

/** Keep the live transcript bounded (localStorage keeps even less). */
const capScrollback = (current: Line[]): Line[] =>
  current.length > MAX_SCROLLBACK ? current.slice(-MAX_SCROLLBACK) : current;

export function PracticeTerminalPage() {
  /* ---- persisted state ---- */
  const [lines, setLines] = useState<Line[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [solvedMissions, setSolvedMissions] = useState<string[]>([]);
  const [commandsRun, setCommandsRun] = useState(0);

  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('linuxdocs.practice-terminal');
      if (saved) {
        const parsed = JSON.parse(saved) as { lines?: Line[]; history?: string[]; solved?: string[]; commandsRun?: number };
        if (Array.isArray(parsed.lines)) setLines(parsed.lines.slice(-160));
        if (Array.isArray(parsed.history)) setHistory(parsed.history.slice(-60));
        if (Array.isArray(parsed.solved)) setSolvedMissions(parsed.solved.filter((id) => ALL_LEVEL_IDS.includes(id)));
        if (typeof parsed.commandsRun === 'number') setCommandsRun(parsed.commandsRun);
      }
    } catch {
      /* corrupted storage - start clean */
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(
        'linuxdocs.practice-terminal',
        JSON.stringify({ lines: lines.slice(-160), history: history.slice(-60), solved: solvedMissions, commandsRun }),
      );
    } catch {
      /* storage full or blocked - keep the session in memory */
    }
  }, [lines, history, solvedMissions, commandsRun]);

  /* ---- live view state ---- */
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState(HOME);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [welcome, setWelcome] = useState(true);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = bodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [lines, welcome]);

  /* -------- derived mission level -------- */
  const activeLevelIndex = useMemo(
    () => MISSION_LEVELS.findIndex((level) => level.missions.some((mission) => !solvedMissions.includes(mission.id))),
    [solvedMissions],
  );
  const mastered = activeLevelIndex === -1;
  const activeLevel: MissionLevel = mastered ? MISSION_LEVELS[MISSION_LEVELS.length - 1] : MISSION_LEVELS[activeLevelIndex];
  const activeLevelSolved = activeLevel.missions.filter((mission) => solvedMissions.includes(mission.id)).length;
  const activeLevelTotal = activeLevel.missions.length;
  const advancedFromPrevious = activeLevelIndex > 0 || mastered;
  const chips = mastered ? [] : activeLevel.chips;

  /* -------- command plumbing -------- */

  const runCommand = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      const inputLine: Line = { input: trimmed, output: '' };

      if (!trimmed) {
        setLines((current) => [...capScrollback(current), inputLine]);
        return;
      }

      let nextCwd = cwd;
      const result = executeCommand(trimmed, nextCwd, (dir) => {
        nextCwd = dir;
      });
      setCwd(nextCwd);

      if (result.clear) {
        setLines([]);
      } else {
        setLines((current) => capScrollback([...current, inputLine, ...result.lines]));
      }

      setHistory((current) => [...current.filter((old) => old !== trimmed), trimmed].slice(-60));
      setCommandsRun((current) => current + 1);

      /* missions run against the FULL transcript, then merge into solved -
          nothing already solved can un-complete */
      const transcript = [...lines, inputLine, ...result.lines];
      const solvedNow = evaluateMissions(transcript);
      if (solvedNow.length) setSolvedMissions((current) => Array.from(new Set([...current, ...solvedNow])));
    },
    [cwd, lines],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (input.trim()) {
      runCommand(input);
      setHistoryIndex(-1);
    }
    setInput('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!history.length) return;
      const nextIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex] ?? '');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    } else if (event.ctrlKey && event.key === 'l') {
      event.preventDefault();
      setLines([]);
    }
  };

  const resetAll = () => {
    if (!window.confirm('Reset terminal progress, transcript and mission levels?')) return;
    setLines([]);
    setHistory([]);
    setSolvedMissions([]);
    setCommandsRun(0);
    setCwd(HOME);
    setWelcome(true);
    inputRef.current?.focus();
  };

  const activateSession = () => {
    setWelcome(false);
    if (lines.length === 0) {
      setLines(WELCOME_GREETING);
    }
    inputRef.current?.focus();
  };

  const shortPath = cwd.replace(HOME, '~');

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        {/* ---------------- header ---------------- */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-[var(--terminal-green)]">
              <Terminal className="h-3.5 w-3.5" /> ~/practice-terminal
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Practice Terminal</h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">
              A safe, simulated Linux box. Clear every mission of a level and the next level opens - with fewer helper
              commands under the terminal, the way a real operator earns them.
            </p>
          </div>
          <button
            onClick={resetAll}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 py-2 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:border-rose-400/60 hover:text-rose-400"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </header>

        {/* ---------------- progress dashboard ---------------- */}
        <section aria-label="Your progress" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Rank</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold sm:text-xl">
              <Trophy className={`h-5 w-5 shrink-0 ${mastered ? 'text-[var(--terminal-green)]' : 'text-amber-400'}`} />
              {mastered ? 'Mastered' : `Level ${activeLevel.level} · ${activeLevel.title}`}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{activeLevel.subtitle}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Missions solved</p>
            <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl">
              {solvedMissions.length}
              <span className="text-sm font-medium text-[var(--text-muted)]">/{TOTAL_MISSIONS}</span>
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className="h-full rounded-full bg-[var(--terminal-green)] transition-all"
                style={{ width: `${Math.round((solvedMissions.length / TOTAL_MISSIONS) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              This level: {activeLevelSolved}/{activeLevelTotal}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Commands run</p>
            <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl">{commandsRun}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Saved on this device with your progress.</p>
          </div>
        </section>

        {advancedFromPrevious && (
          <div className="mb-6 rounded-xl border border-[var(--terminal-green)]/40 bg-[var(--terminal-green)]/10 px-4 py-2.5 text-sm">
                {mastered ? (
                  <span className="font-medium text-[var(--terminal-green)]">
                    Every level cleared - helper commands are retired. The sandbox is all yours now.
                  </span>
                ) : (
                  <span className="font-medium text-[var(--terminal-green)]">
                    Level {activeLevelIndex} complete! Missions for Level {activeLevel.level} - {activeLevel.title} - are now open.
                  </span>
                )}
          </div>
        )}

        {/* ---------------- terminal + missions ---------------- */}
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <section aria-label="Terminal">
            <div
              onClick={activateSession}
              className="cursor-text overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--terminal-bg)] shadow-lg shadow-black/20"
            >
              <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
                <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-400/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">learner@linuxdocs · {shortPath}</span>
              </div>

              <div ref={bodyRef} className="h-[380px] overflow-y-auto px-4 py-3 sm:h-[460px]" aria-live="polite">
                {welcome ? (
                  <div className="font-mono text-sm leading-relaxed">
                    <p className="text-[var(--terminal-green)]">LinuxDocs Practice Sandbox v3</p>
                    <p className="mt-2 text-[var(--text-muted)]">13 missions across 3 levels are loaded into this box.</p>
                    <p className="text-[var(--text-muted)]">Click here to start typing - or check the missions on the right.</p>
                    <p className="mt-2 text-[var(--terminal-green)]">_</p>
                  </div>
                ) : (
                  lines.map((line, index) => (
                    <div key={index} className="font-mono text-xs leading-relaxed sm:text-sm">
                      {line.input !== undefined ? (
                        <p className="break-all">
                          <span className="text-[var(--terminal-green)]">learner@linuxdocs</span>
                          <span className="text-[var(--text-muted)]">:{shortPath}$ </span>
                          <span className="text-[var(--text)]">{line.input}</span>
                        </p>
                      ) : (
                        line.output && <pre className={`whitespace-pre-wrap break-words font-mono ${toneClass(line.tone)}`}>{line.output}</pre>
                      )}
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <label htmlFor="term-input" className="shrink-0 font-mono text-xs text-[var(--terminal-green)] sm:text-sm">
                  <span className="hidden sm:inline">learner@linuxdocs</span>
                  <span className="text-[var(--text-muted)]">:{shortPath}$</span>
                </label>
                <input
                  id="term-input"
                  ref={inputRef}
                  value={input}
                  maxLength={MAX_INPUT_LENGTH}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={welcome ? 'Click the terminal first…' : 'Type a command… (↑ history)'}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onFocus={() => setWelcome(false)}
                  className="min-w-0 flex-1 bg-transparent font-mono text-base text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]/60 sm:text-sm"
                />
              </form>
            </div>
          </section>

          <div className="space-y-4">
            <section aria-label="Current missions">
              <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <Target className="h-3.5 w-3.5" /> {mastered ? 'Missions' : `Level ${activeLevel.level} missions`}
              </p>
              <div className="space-y-2">
                {(mastered ? [] : activeLevel.missions).map((mission) => {
                  const solved = solvedMissions.includes(mission.id);
                  return (
                    <div
                      key={mission.id}
                      className={`rounded-lg border p-3 text-sm transition-colors ${
                        solved ? 'border-[var(--terminal-green)]/50 bg-[var(--terminal-green)]/5' : 'border-[var(--border)] bg-[var(--surface)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{mission.title}</p>
                        <span aria-hidden="true">{solved ? '✅' : '🎯'}</span>
                      </div>
                      {!solved && <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{mission.hint}</p>}
                    </div>
                  );
                })}
                {mastered && (
                  <div className="rounded-lg border border-[var(--terminal-green)]/50 bg-[var(--terminal-green)]/5 p-4 text-center text-sm">
                    <Trophy className="mx-auto h-6 w-6 text-[var(--terminal-green)]" />
                    <p className="mt-2 font-semibold">All {TOTAL_MISSIONS} missions solved</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Free practice from here - no rails, no helpers.</p>
                  </div>
                )}
              </div>
            </section>

            <section aria-label="Quick commands">
              <p className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                <Lightbulb className="h-3.5 w-3.5" /> Quick commands
              </p>
              {chips.length ? (
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        setInput(chip);
                        inputRef.current?.focus();
                      }}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-xs text-[var(--text)] transition-colors hover:border-[var(--terminal-green)] hover:text-[var(--terminal-green)]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-center text-xs text-[var(--text-muted)]">
                  <Lock className="mx-auto h-4 w-4 opacity-60" />
                  <p className="mt-1">No helpers at this level - type from memory.</p>
                </div>
              )}
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Helpers shrink as levels rise: level {mastered ? 3 : activeLevel.level} of 3, zero once the box is mastered.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PracticeTerminalPage;
