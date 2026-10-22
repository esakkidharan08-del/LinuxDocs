import React, { useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Home, Search, Terminal, Shield } from 'lucide-react';
import { useCatalog } from '../context/CatalogContext';

type VoidLine = { text: string; tone?: 'ok' | 'dim' | 'err' };

const VOID_GREETING: VoidLine[] = [
  { text: 'a stray shell has attached itself to this error page…', tone: 'dim' },
  { text: 'type help to see what it still remembers', tone: 'dim' },
];

function resolveVoidCommand(raw: string, alreadyFound: boolean): { lines: VoidLine[]; found: boolean } {
  const input = raw.trim().toLowerCase();
  if (!input) return { lines: [], found: false };
  const cmd = input.split(/\s+/)[0];
  const arg = input.split(/\s+/).slice(1).join(' ');

  switch (cmd) {
    case 'help':
      return { lines: [{ text: 'help   ls   cat <file>   sudo   clear' }], found: false };
    case 'ls':
      return { lines: [{ text: 'help.txt  flag.hidden  .void' }], found: false };
    case 'cat': {
      if (arg === 'flag.hidden' || arg === '.void/flag.hidden' || arg === './flag.hidden') {
        if (alreadyFound) return { lines: [{ text: 'the flag is already claimed - helmet on, walker.', tone: 'dim' }], found: false };
        return {
          lines: [
            { text: 'flag{v01d_w4lk3r_404}', tone: 'ok' },
            { text: 'you searched a broken page and found treasure. wear it well.', tone: 'dim' },
          ],
          found: true,
        };
      }
      if (arg === 'help.txt' || arg === '.void/help.txt') {
        return { lines: [{ text: 'the void speaks: every 404 hides exactly one flag.' }], found: false };
      }
      return { lines: [{ text: `cat: ${arg || '???'}: no such file in the void`, tone: 'err' }], found: false };
    }
    case 'sudo':
      return { lines: [{ text: 'sudo is unreal here. the void stays void.', tone: 'err' }], found: false };
    case 'clear':
      return { lines: VOID_GREETING, found: false };
    default:
      return { lines: [{ text: `bash: ${cmd}: command not found (the void hears only: help)` }], found: false };
  }
}

export const NotFoundPage: React.FC = () => {
  const { categories } = useCatalog();
  const [lines, setLines] = useState<VoidLine[]>(VOID_GREETING);
  const [value, setValue] = useState('');
  const [foundVoid, setFoundVoid] = useState(false);

  const submitVoid = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) return;
    const result = resolveVoidCommand(value, foundVoid);
    setLines((current) => [...current, { text: value, tone: 'dim' }, ...result.lines]);
    if (result.found) setFoundVoid(true);
    setValue('');
  };

  const voidKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') setValue('');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="space-y-6">
        <p className="inline-flex items-center gap-2 rounded border border-[var(--ctf-red)]/35 bg-[var(--ctf-red-bg)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ctf-red)]">
          <Terminal className="h-3.5 w-3.5" />
          exit code 404
        </p>

        <h1 className="font-display text-5xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-6xl">
          path not found
        </h1>

        <p className="max-w-[56ch] font-mono text-sm leading-relaxed text-[var(--text-muted)]">
          bash: cd: the requested path does not exist on this filesystem. Check the URL, or start from one of these.
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-5 py-2.5 font-mono text-sm font-semibold text-[var(--bg)] hover:bg-[var(--terminal-green-dim)]"
          >
            <Home className="h-4 w-4" />
            cd /home
          </Link>
          <Link
            to="/ctf"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-5 py-2.5 font-mono text-sm font-semibold text-[var(--text)] hover:border-[var(--ctf-red)]/50 hover:text-[var(--ctf-red)]"
          >
            <Shield className="h-4 w-4" />
            CTF reference
          </Link>
        </div>

        <div className="border-t border-[var(--border)] pt-6">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
            <Search className="h-3.5 w-3.5" />
            Or jump into a category
          </p>
          {/* Category chips come from the catalog (auth-gated). Signed-out
              visitors keep the void shell — no dataset metadata leaks here. */}
          {categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categories.filter((cat) => cat.section === 'linux').slice(0, 8).map((cat) => (
                <Link
                  key={cat.id}
                  to={`/linux/${cat.id}`}
                  className="rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-xs text-[var(--text)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* stray shell mini-easter-egg */}
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--terminal-bg)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            <span className="ml-2 font-mono text-[11px] text-[var(--text-muted)]">/dev/void · escaped error shell</span>
          </div>
          <div className="h-[150px] overflow-y-auto px-4 py-3 font-mono text-xs leading-relaxed sm:text-sm">
            {lines.map((line, index) => (
              <pre
                key={index}
                className={`whitespace-pre-wrap break-words font-mono ${
                  line.tone === 'ok'
                    ? 'text-emerald-400'
                    : line.tone === 'err'
                      ? 'text-rose-400'
                      : 'text-[var(--text-muted)]'
                }`}
              >
                {line.text}
              </pre>
            ))}
          </div>
          <form onSubmit={submitVoid} className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5">
            <label htmlFor="void-input" className="shrink-0 font-mono text-xs text-[var(--terminal-green)]">
              void@404:~$
            </label>
            <input
              id="void-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={voidKeyDown}
              autoComplete="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-[var(--text)] outline-none"
              aria-label="Void terminal"
            />
          </form>
        </div>
        {foundVoid && (
          <p className="font-mono text-xs text-emerald-400">
            void flag captured: <code className="rounded border border-emerald-400/40 px-1.5 py-0.5">flag{'{v01d_w4lk3r_404}'}</code>
          </p>
        )}

        <p className="pt-1 font-mono text-xs text-[var(--text-muted)]">
          Tip: press <kbd className="rounded border border-[var(--border)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5">Ctrl K</kbd> to search every command.
        </p>
      </div>
    </div>
  );
};
