/* eslint-disable */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { Lightbulb, Lock, RotateCcw, Target, Terminal, Trophy } from 'lucide-react';
import { getCommand } from '../data/commands';

type Line = { input?: string; output: string; tone?: 'error' | 'muted' | 'success' | 'hint' };
type Mission = { id: string; title: string; hint: string };
type MissionLevel = { level: number; title: string; subtitle: string; missions: Mission[]; chips: string[] };

/* ============================================================
   Missions are grouped into levels. The next level's missions only
   appear once every mission of the current level is solved - and the
   quick-command hints under the terminal shrink as you climb.
   ============================================================ */

const MISSION_LEVELS: MissionLevel[] = [
  {
    level: 1,
    title: 'Boot Camp',
    subtitle: 'Navigation and reading files - walk before you run',
    missions: [
      { id: 'm1', title: 'Capture the flag', hint: 'A file named flag.txt sits in the home directory. Read it.' },
      { id: 'm2', title: 'Find the cheat sheet', hint: 'There is a notes folder. Step in and read cheatsheet.txt.' },
      { id: 'm3', title: 'Meet the manual', hint: 'Run man with any command name, e.g. man ls.' },
    ],
    chips: ['ls', 'cd notes', 'cat cheatsheet.txt', 'cat flag.txt', 'pwd', 'man ls'],
  },
  {
    level: 2,
    title: 'Explorer',
    subtitle: 'Search, inspect, measure - the daily toolkit',
    missions: [
      { id: 'm5', title: 'Orient yourself', hint: 'cd around (home AND a subfolder) and run pwd in both. Know where you stand.' },
      { id: 'm4', title: 'Search for a needle', hint: 'Run grep with a pattern and a file, e.g. grep TODO todo.txt.' },
      { id: 'm6', title: 'Reveal hidden details', hint: 'Run ls -la and see what plain ls hides.' },
      { id: 'm7', title: 'Both ends of a file', hint: 'Run head README.txt and later tail README.txt.' },
      { id: 'm8', title: 'Measure the text', hint: 'Run wc README.txt to count lines, words and characters.' },
    ],
    chips: ['ls -la', 'head README.txt', 'tail README.txt', 'wc README.txt'],
  },
  {
    level: 3,
    title: 'Operative',
    subtitle: 'Full command of the box - almost no handrails',
    missions: [
      { id: 'm9', title: 'Locate everything', hint: 'Run find to list every file on this training box.' },
      { id: 'm10', title: 'Environment check', hint: 'Run env and see what the shell inherits.' },
      { id: 'm11', title: 'Identity check', hint: 'Run both whoami and date at some point.' },
      { id: 'm12', title: 'Project artifacts', hint: 'Inspect script.sh AND data.json inside projects.' },
      { id: 'm13', title: 'Recon the arsenal', hint: 'Read the manual of any CTF tool, e.g. man nmap or man hydra.' },
    ],
    chips: ['help'],
  },
];

const CTF_TOOLS = [
  'nmap', 'hydra', 'john', 'sqlmap', 'gobuster', 'hashcat', 'binwalk', 'exiftool', 'steghide', 'nikto',
  'ffuf', 'wpscan', 'searchsploit', 'openssl', 'radare2', 'jadx', 'volatility', 'subfinder', 'masscan',
  'rustscan', 'feroxbuster', 'wfuzz', 'smbclient', 'whois', 'strings', 'checksec', 'hashid', 'trivy',
];

export const TOTAL_MISSIONS = MISSION_LEVELS.reduce((n, level) => n + level.missions.length, 0);
const ALL_LEVEL_IDS = MISSION_LEVELS.flatMap((level) => level.missions.map((mission) => mission.id));

/* ---------------- simulated filesystem ---------------- */

const FILES: Record<string, string> = {
  'README.txt': 'LinuxDocs practice sandbox.\nEverything here is simulated - break nothing.\nStart with: ls, then cat cheatsheet.txt inside notes/.\nMissions in the sidebar track your progress.',
  'flag.txt': 'flag{terminal_practice_101}',
  'notes/cheatsheet.txt': 'CHEAT SHEET\nnavigation: pwd ls cd\ntext: cat grep head tail wc\nsearch: find\nhelp: man <command>\nservices: systemctl journalctl',
  'notes/todo.txt': 'TODO\n- pass every path quiz\n- read one man page a day\n- build a grep/sort/uniq pipeline',
  'projects/script.sh': '#!/bin/bash\n# tiny deploy script\nset -euo pipefail\nrsync -avz dist/ server:/var/www/\nsystemctl restart nginx\necho "deploy complete"',
  'projects/data.json': '{\n  "service": "linuxdocs",\n  "version": "2.0",\n  "healthy": true,\n  "domains": ["linux", "ctf"]\n}',
  'exercises/drill.md': 'DAILY DRILL\n1. ls -la and read the permission column\n2. explain one flag of ps aux\n3. journalctl -p err on any box you own',
};

const SUBDIRS = ['notes', 'projects', 'exercises'];
const HOME = '/home/learner';

const ENV_ROWS = [
  'USER=learner',
  'HOME=/home/learner',
  'SHELL=/bin/bash',
  'PATH=/usr/local/bin:/usr/bin:/bin',
  'LANG=en_US.UTF-8',
  'TERM=xterm-256color',
  'EDITOR=nano',
];
const WELCOME_GREETING: Line[] = [
  { output: 'Sandbox ready. Everything here is simulated.', tone: 'success' },
  { output: 'Missions appear on the right. Solve every mission of a level to unlock the next one.', tone: 'muted' },
  { output: 'Type help to list every available command. Arrow keys walk your history.', tone: 'hint' },
];

/* ---------------- mission evaluation ---------------- */

function extractInputs(transcript: Line[]): string[] {
  return transcript.filter((line) => line.input !== undefined).map((line) => (line.input ?? '').trim().toLowerCase());
}
function extractOutputs(transcript: Line[]): string[] {
  return transcript.filter((line) => line.input === undefined).map((line) => line.output);
}

export function evaluateMissions(transcript: Line[]): string[] {
  const cmds = extractInputs(transcript);
  const outputs = extractOutputs(transcript);
  const has = (re: RegExp) => cmds.some((c) => re.test(c));
  const solved: string[] = [];

  if (has(/^cat\s+["']?flag\.txt["']?$/) || outputs.some((o) => o.includes('flag{terminal_practice_101}'))) solved.push('m1');
  if (has(/^cat\s+["']?cheatsheet\.txt["']?$/)) solved.push('m2');
  if (has(/^man\s+[a-z]/)) solved.push('m3');
  if (has(/^grep\s+(?:-\S+\s+)*\S+\s+\S+/)) solved.push('m4');
  const visitedHome = outputs.some((o) => o.trim() === HOME);
  const visitedSub = outputs.some((o) => SUBDIRS.some((dir) => o.trim() === HOME + '/' + dir));
  if (visitedHome && visitedSub) solved.push('m5');
  if (has(/^ls\s+(?:-la|-al|-l\s+-a|-a\s+-l)$/)) solved.push('m6');
  if (
    has(/^head\s+(?:-n\s+\d+\s+)?["']?readme\.txt["']?$/) &&
    has(/^tail\s+(?:-n\s+\d+\s+)?["']?readme\.txt["']?$/)
  )
    solved.push('m7');
  if (has(/^wc\s+(?:-\S+\s+)*["']?readme\.txt["']?$/)) solved.push('m8');
  if (has(/^find\b/)) solved.push('m9');
  if (has(/^env$/)) solved.push('m10');
  if (has(/^whoami$/) && has(/^date$/)) solved.push('m11');
  if (has(/^cat\s+["']?script\.sh["']?$/) && has(/^cat\s+["']?data\.json["']?$/)) solved.push('m12');
  if (has(new RegExp('^man\\s+(' + CTF_TOOLS.join('|') + ')\\s*$'))) solved.push('m13');

  return solved.filter((id) => ALL_LEVEL_IDS.includes(id));
}

/* ============================================================
   Component
   ============================================================ */

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
  const activeLevel = mastered ? MISSION_LEVELS[MISSION_LEVELS.length - 1] : MISSION_LEVELS[activeLevelIndex];
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
        setLines((current) => [...current, inputLine]);
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
        setLines((current) => [...current, inputLine, ...result.lines]);
      }

      setHistory((current) => [...current.filter((old) => old !== trimmed), trimmed]);
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

/* ============================================================
   Interpreter
   ============================================================ */

type ExecResult = { lines: Line[]; clear?: boolean };

function resolveFileByName(name: string): { key: string; content: string } | null {
  const wanted = name.replace(/^["']|["']$/g, '').replace(/^\.?\//, '').replace(/^~\/?/, '');
  if (FILES[wanted]) return { key: wanted, content: FILES[wanted] };
  const base = (wanted.split('/').pop() ?? wanted).toLowerCase();
  const match = Object.keys(FILES).find((key) => (key.split('/').pop() ?? key).toLowerCase() === base);
  return match ? { key: match, content: FILES[match] } : null;
}

function entriesOf(dir: string): { name: string; type: 'file' | 'dir'; size: number }[] {
  const prefix = dir === HOME ? '' : dir.replace(HOME + '/', '') + '/';
  const files = Object.keys(FILES)
    .filter((key) => (dir === HOME ? !key.includes('/') : key.startsWith(prefix)))
    .map((key) => ({
      name: (key.split('/').pop() ?? key) + '',
      type: 'file' as const,
      size: (FILES[key] ?? '').length + 64,
    }));
  if (dir !== HOME) return files;
  return [...SUBDIRS.map((name) => ({ name, type: 'dir' as const, size: 4096 })), ...files];
}

export function executeCommand(input: string, cwd: string, setCwd: (dir: string) => void): ExecResult {
  const parts = input.trim().split(/\s+/).filter(Boolean);
  const cmd = (parts[0] ?? '').toLowerCase();
  const args = parts.slice(1);
  const err = (message: string): ExecResult => ({ lines: [{ output: message, tone: 'error' }] });
  const out = (message: string, tone?: Line['tone']): ExecResult => ({ lines: [{ output: message, tone }] });

  switch (cmd) {
    case 'help':
      return out(
        [
          'Available commands:',
          '  ls [-la]   cd <dir|..>   pwd        cat <file>',
          '  head [-n N] <file>       tail [-n N] <file>    wc <file>',
          '  grep <pattern> <file>    find [pattern]        man <command>',
          '  stat <file>  touch <f>   mkdir <d>  rm <f>  echo <text>',
          '  env  whoami  date  uname [-a]  history  clear  banner  help',
        ].join('\n'),
      );

    case 'banner':
      return out(['LinuxDocs Practice Sandbox v3', 'missions loaded: 13   levels: 3', 'Learn. Practice. Master.'].join('\n'), 'success');

    case 'pwd':
      return out(cwd);

    case 'ls': {
      const showAll = args.some((a) => a.startsWith('-') && a.includes('a'));
      const showLong = args.some((a) => a.startsWith('-') && a.includes('l'));
      const entries = entriesOf(cwd);
      const hidden = showAll ? ['.bashrc', '.profile'] : [];
      if (showLong) {
        const rows = entries
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (entry) =>
              `${entry.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--'}  1 learner learner ${String(entry.size).padStart(6)} ${
                entry.type === 'dir' ? entry.name + '/' : entry.name
              }`,
          );
        hidden.forEach((name) => rows.push(`-rw-r--r--  1 learner learner    220 ${name}`));
        return out(`total ${entries.length + hidden.length}\n${rows.join('\n')}`);
      }
      const names = [
        ...entries.map((entry) => (entry.type === 'dir' ? entry.name + '/' : entry.name)),
        ...hidden,
      ];
      return out(names.join('    '));
    }

    case 'cd': {
      const target = args[0];
      if (!target || target === '~') {
        setCwd(HOME);
        return { lines: [] };
      }
      if (target === '/') {
        setCwd(HOME);
        return { lines: [{ output: 'Only /home/learner exists in this sandbox.', tone: 'muted' }] };
      }
      if (target === '..') {
        setCwd(cwd === HOME ? HOME : HOME);
        return { lines: [] };
      }
      const name = target.replace(/\/+$/, '').split('/').pop() ?? target;
      if (SUBDIRS.includes(name)) {
        if (cwd === HOME || cwd === HOME + '/' + name) {
          setCwd(HOME + '/' + name);
          return { lines: [] };
        }
      }
      return err(`cd: ${target}: No such directory (this sandbox keeps you near home)`);
    }

    case 'cat': {
      if (!args[0]) return err('cat: missing file operand');
      const resolved = resolveFileByName(args[0]);
      if (!resolved) return err(`cat: ${args[0]}: no such file in the sandbox`);
      return out(resolved.content);
    }

    case 'head':
    case 'tail': {
      let count = 10;
      let fileArg = args[0];
      if (args[0] === '-n') {
        count = Math.max(1, Number(args[1]) || 10);
        fileArg = args[2];
      }
      if (!fileArg) return err(`${cmd}: missing file operand`);
      const resolved = resolveFileByName(fileArg);
      if (!resolved) return err(`${cmd}: ${fileArg}: no such file in the sandbox`);
      const rows = resolved.content.split('\n');
      const picked = cmd === 'head' ? rows.slice(0, count) : rows.slice(-count);
      return out(picked.join('\n'));
    }

    case 'wc': {
      const fileArg = args[0] && args[0].startsWith('-') ? args[1] : args[0];
      if (!fileArg) return err('wc: give a file, e.g. wc README.txt');
      const resolved = resolveFileByName(fileArg);
      if (!resolved) return err(`wc: ${fileArg}: no such file in the sandbox`);
      const lineCount = resolved.content.split('\n').length;
      return out(`${lineCount} ${resolved.content.split(/\s+/).filter(Boolean).length} ${resolved.content.length} ${resolved.key}`);
    }

    case 'grep': {
      if (args.length < 2) return err('usage: grep <pattern> <file>');
      const pattern = args[0].replace(/^["']|["']$/g, '');
      const fileArg = args[args.length - 1];
      const resolved = resolveFileByName(fileArg);
      if (!resolved) return err(`grep: ${fileArg}: no such file in the sandbox`);
      const matches = resolved.content.split('\n').filter((row) => row.toLowerCase().includes(pattern.toLowerCase()));
      return matches.length
        ? out(matches.join('\n'))
        : out(`(no lines matched "${pattern}" in ${resolved.key})`, 'muted');
    }

    case 'find': {
      const prefix = cwd === HOME ? '' : cwd.replace(HOME + '/', '') + '/';
      let rows = Object.keys(FILES);
      if (prefix) rows = rows.filter((key) => key.startsWith(prefix));
      rows = rows.map((key) => './' + key);
      return out(['.', ...rows].join('\n'), 'muted');
    }

    case 'man': {
      const name = (args[0] ?? '').toLowerCase();
      if (!name) return err('What manual page do you want? e.g. man ls');
      const data = getCommand(name);
      if (!data) return err(`No manual entry for ${name}. Type help to see the sandbox commands.`);
      const meta = [`${data.name.toUpperCase()}(1)`, '', `NAME  ${data.name} - ${data.summary}`];
      if (data.category) meta.push(`SECTION  ${data.category} (${data.section})`);
      meta.push('', 'This sandbox prints the stored summary from the LinuxDocs dataset.', 'The full man page lives on your real system.');
      return out(meta.join('\n'));
    }

    case 'stat': {
      if (!args[0]) return err('stat: missing file operand');
      const resolved = resolveFileByName(args[0]);
      if (!resolved) return err(`stat: ${args[0]}: no such file in the sandbox`);
      return out(
        `File: ${resolved.key}\nSize: ${resolved.content.length}\tBlocks: 8\tType: regular file\nAccess: (0644/-rw-r--r--)  Uid: (1000/learner)`,
        'muted',
      );
    }

    case 'touch': {
      if (!args[0]) return err('touch: missing file operand');
      return out(`(simulated) timestamp refreshed for ${args[0]}`, 'muted');
    }

    case 'mkdir': {
      if (!args[0]) return err('mkdir: missing operand');
      return out(`(simulated) created directory ${args[0]}`, 'muted');
    }

    case 'rm': {
      if (!args[0]) return err('rm: missing operand');
      return out(`(simulated) nothing was deleted - the practice box resets itself`, 'muted');
    }

    case 'echo':
      return out(args.join(' ').replace(/^["']|["']$/g, ''));

    case 'env':
      return out(ENV_ROWS.join('\n'), 'muted');

    case 'whoami':
      return out('learner');

    case 'date':
      return out(new Date().toString());

    case 'uname':
      return out(args.includes('-a') ? 'Linux linuxdocs-sandbox 6.8.0-practice #3 SMP x86_64 GNU/Linux' : 'Linux');

    case 'history':
      return out('History is stored in this browser - press the up arrow to walk through it', 'muted');

    case 'sudo':
      return out('sudo is disabled in sandbox mode - nice try anyway', 'hint');

    case 'exit':
      return out('Everything here is simulated. You cannot exit the practice.', 'hint');

    case 'clear':
      return { lines: [], clear: true };

    default:
      return err(`${cmd}: command not found in this sandbox - try: help`);
  }
}

function toneClass(tone?: Line['tone']): string {
  switch (tone) {
    case 'error':
      return 'text-rose-400';
    case 'success':
      return 'text-[var(--terminal-green)]';
    case 'hint':
      return 'text-cyan-400';
    case 'muted':
      return 'text-[var(--text-muted)]';
    default:
      return 'text-[var(--text)]';
  }
}

export default PracticeTerminalPage;
