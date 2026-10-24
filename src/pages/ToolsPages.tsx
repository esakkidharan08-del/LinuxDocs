import { useState, useMemo, type ChangeEvent } from 'react';
import { Download, GitCompare, Shuffle, Upload, Info } from 'lucide-react';
import { getPathForLight, useCatalog, useAllCommands, useCommandDocs } from '../context/CatalogContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProgress } from '../context/ProgressContext';
import { PROGRESS_KEYS, toSyncPayload } from '../lib/progress';
import type { ProgressKey } from '../lib/progress';
import type { Command, CommandLight } from '../types';

/** Shared loading/error panel for the doc-backed tools pages. */
const DocsGate = ({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) => {
  if (error) {
    return (
      <div className="rounded-xl border border-rose-400/40 bg-[var(--bg-surface)] p-8 text-center">
        <p className="font-mono text-sm text-rose-400">{error}</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-10 text-center font-mono text-sm text-[var(--text-muted)]">
        loading command docs<span className="blinking">_</span>
      </div>
    );
  }
  return <>{children}</>;
};

/** Curated classic-versus pairs — one click loads both sides. Slugs are
    validated against the dataset when this list changes (a pair whose
    slug is missing from the index simply does not render). */
const CURATED_PAIRS: Array<{ a: string; b: string; why: string }> = [
  { a: 'grep', b: 'sed', why: 'filter vs edit in-line' },
  { a: 'awk', b: 'grep', why: 'patterns vs per-field programs' },
  { a: 'ripgrep', b: 'grep', why: 'the fast modern re-implementation' },
  { a: 'head', b: 'tail', why: 'two ends of the same file' },
  { a: 'cat', b: 'less', why: 'dump everything vs page through' },
  { a: 'find', b: 'ls', why: 'recursive search vs one listing' },
  { a: 'locate', b: 'find', why: 'prebuilt index vs live walk' },
  { a: 'rm', b: 'rmdir', why: 'anything vs empty directories only' },
  { a: 'cp', b: 'mv', why: 'duplicate vs relocate' },
  { a: 'dd', b: 'cp', why: 'device-level bytes vs files' },
  { a: 'chmod', b: 'chown', why: 'bits vs ownership' },
  { a: 'useradd', b: 'passwd', why: 'account vs its credential' },
  { a: 'ps', b: 'top', why: 'snapshot vs live monitor' },
  { a: 'kill', b: 'pkill', why: 'by pid vs by name' },
  { a: 'systemctl', b: 'journalctl', why: 'control services vs read their logs' },
  { a: 'curl', b: 'wget', why: 'APIs and pipes vs resumable downloads' },
  { a: 'ssh', b: 'scp', why: 'remote shell vs file copy over the same auth' },
  { a: 'tar', b: 'gzip', why: 'bundle vs compress' },
  { a: 'nmap', b: 'nikto', why: 'port surface vs web app checks' },
  { a: 'john', b: 'hashcat', why: 'cpu rules vs gpu engines' },
  { a: 'netstat', b: 'ss', why: 'the classic vs its faster successor' },
];

export const ComparePage = () => {
  const [leftSlug, setLeftSlug] = useState('grep');
  const [rightSlug, setRightSlug] = useState('sed');
  const [viewAll, setViewAll] = useState(false);
  // The picker list comes from the light index; only the two chosen commands
  // load their full docs (on demand, cached in memory — Part 1).
  const { lights } = useCatalog();
  const linuxLights = useMemo(() => lights.filter((command) => command.section === 'linux'), [lights]);
  const cmdLights = useMemo(
    () => (viewAll ? [...lights].sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name)) : linuxLights),
    [viewAll, lights, linuxLights],
  );
  const compareSlugs = useMemo(() => [leftSlug, rightSlug], [leftSlug, rightSlug]);
  const { docs, loading, error } = useCommandDocs(compareSlugs);

  const left = docs.find((command) => command.slug === leftSlug) || docs[0];
  const right = docs.find((command) => command.slug === rightSlug) || docs[1];
  const hasBoth = !!left && !!right;

  const select = (value: string, onChange: (value: string) => void) => <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)] focus:border-[var(--terminal-green)] focus:outline-none">{cmdLights.map((command) => <option key={command.slug} value={command.slug}>{command.section === 'ctf' ? '[CTF]' : '[LINUX]'} {command.name}</option>)}</select>;

  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6"><header className="space-y-4"><div className="flex flex-wrap items-center gap-3"><div className="inline-flex items-center gap-2 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-xs text-[var(--terminal-green)]"><GitCompare className="h-4 w-4" /> Side-by-Side Comparison</div><button onClick={() => setViewAll(!viewAll)} className="inline-flex items-center gap-2 rounded border border-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--terminal-green)] hover:border-[var(--terminal-green)]">{viewAll ? 'Show Linux only' : 'Show all commands (Linux + CTF)'}</button></div><div><h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--text-heading)] tracking-tight">Compare Commands</h1><p className="mt-3 text-lg text-[var(--text-muted)] max-w-3xl">Compare purpose, syntax, options, use cases, examples, and related commands side-by-side. Perfect for understanding differences between similar tools.</p></div></header>
    <DocsGate loading={loading || !lights.length} error={error}>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <p className="mb-3 font-mono text-xs uppercase tracking-widest text-[var(--text-muted)]">Curated classic match-ups</p>
        <div className="flex flex-wrap gap-2">
          {CURATED_PAIRS.map((pair) => {
            const known = cmdLights.some((light) => light.slug === pair.a) && cmdLights.some((light) => light.slug === pair.b);
            if (!known) return null;
            const active = leftSlug === pair.a && rightSlug === pair.b;
            return (
              <button
                key={`${pair.a}|${pair.b}`}
                onClick={() => { setLeftSlug(pair.a); setRightSlug(pair.b); }}
                title={pair.why}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs transition-colors ${
                  active ? 'border-[var(--terminal-green)] bg-[var(--terminal-green)]/10 text-[var(--terminal-green)]' : 'border-[var(--border)] text-[var(--text)] hover:border-[var(--terminal-green)]'
                }`}
              >
                {pair.a} <span className="text-[var(--text-muted)]">vs</span> {pair.b}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">Hover a chip to see why the pairing is interesting. Anything in either dropdown stays fully free-form.</p>
      </div>
      {hasBoth && (
        <>
          <div className="grid gap-6 lg:grid-cols-2"><article className="space-y-4 rounded-xl border-2 border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg)] p-6 shadow-lg"><label className="block space-y-2"><span className="font-mono text-xs uppercase tracking-widest text-[var(--terminal-green)]">Command A</span>{select(leftSlug, setLeftSlug)}</label><CommandColumn command={left!} /></article><article className="space-y-4 rounded-xl border-2 border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg)] p-6 shadow-lg"><label className="block space-y-2"><span className="font-mono text-xs uppercase tracking-widest text-[var(--terminal-green)]">Command B</span>{select(rightSlug, setRightSlug)}</label><CommandColumn command={right!} /></article></div><ComparisonSummary left={left!} right={right!} />
        </>
      )}
    </DocsGate>
  </div>;
};

const CommandColumn = ({ command }: { command: Command }) => <div className="space-y-5"><div className="pb-4 border-b border-[var(--border)]"><div className="flex items-center gap-2 mb-2"><h2 className="font-display text-3xl font-semibold text-[var(--terminal-green)]">{command.name}</h2><span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--border)] text-[var(--text-muted)]">{command.section}</span></div><p className="text-sm text-[var(--text)] leading-relaxed">{command.summary}</p><p className="mt-2 text-xs text-[var(--text-muted)]">Category: <span className="text-[var(--text)]">{command.category}</span></p></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Description</p><p className="text-sm text-[var(--text)] leading-relaxed">{command.description}</p></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Syntax</p><code className="block rounded-lg bg-[var(--code-bg)] p-4 text-sm text-[var(--terminal-green)] font-mono break-all">{command.syntax}</code></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Options / Flags ({command.options.length})</p><ul className="space-y-2">{command.options.length > 0 ? command.options.map((option) => <li key={option.flag} className="flex gap-3 text-sm"><code className="text-[var(--terminal-green)] font-mono shrink-0">{option.flag}</code><span className="text-[var(--text)]">{option.description}{option.example ? <span className="text-[var(--text-muted)]"> — {option.example}</span> : null}</span></li>) : <li className="text-xs text-[var(--text-muted)] italic">No options documented</li>}</ul></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Use Cases</p><div className="flex flex-wrap gap-2">{command.useCases.map((use) => <span key={use} className="px-2.5 py-1 rounded border border-[var(--border)] text-xs text-[var(--text)]">{use}</span>)}</div></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Examples</p><div className="space-y-3">{command.examples.slice(0, 3).map((example) => <div key={example.title} className="rounded-lg bg-[var(--code-bg)] p-3"><p className="text-xs font-medium text-[var(--text)]">{example.title}</p><code className="mt-1 block text-sm text-[var(--terminal-green)] font-mono break-all">${' '}{example.command}</code></div>)}</div></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Related</p><div className="flex flex-wrap gap-1">{command.related.map((slug) => <code key={slug} className="rounded bg-[var(--code-bg)] px-1.5 py-0.5 text-xs text-[var(--text-muted)]">{slug}</code>)}</div></div></div>;

const ComparisonSummary = ({ left, right }: { left: Command, right: Command }) => (
  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 space-y-4">
    <div className="flex items-center gap-2">
      <Info className="h-5 w-5 text-[var(--terminal-green)]" />
      <h3 className="font-display text-xl font-semibold text-[var(--text-heading)]">Quick Comparison</h3>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1"><p className="text-xs font-mono text-[var(--text-muted)] uppercase">Options Count</p><p className="text-lg font-semibold"><span className="text-[var(--terminal-green)]">{left.options.length}</span> vs <span className="text-cyan-400">{right.options.length}</span></p></div>
      <div className="space-y-1"><p className="text-xs font-mono text-[var(--text-muted)] uppercase">Examples</p><p className="text-lg font-semibold"><span className="text-[var(--terminal-green)]">{left.examples.length}</span> vs <span className="text-cyan-400">{right.examples.length}</span></p></div>
      <div className="space-y-1"><p className="text-xs font-mono text-[var(--text-muted)] uppercase">Category</p><p className="text-sm text-[var(--text)]">{left.category} vs {right.category}</p></div>
      <div className="space-y-1"><p className="text-xs font-mono text-[var(--text-muted)] uppercase">Section</p><p className="text-sm text-[var(--text)]">{left.section} vs {right.section}</p></div>
    </div>
  </div>
);

export const CommandOfDayPage = () => {
  // The deterministic daily pick walks the aggregate order, so this page
  // loads the full dataset wave once (then it is instant every visit).
  const { commands, loading, error } = useAllCommands();
  const { lights } = useCatalog();
  const dayIndex = commands.length ? Math.floor(Date.now() / 86400000) % commands.length : 0;
  const command = commands[dayIndex];
  const [randomSlug, setRandomSlug] = useState<string | null>(null);
  /* The tile shows the daily pick until "Pick another" selects a fresh doc. */
  const picked = randomSlug ? commands.find((cmd) => cmd.slug === randomSlug) || command : command;

  // Keep the tile's footer link resolvable even while docs stream in.
  const lightFor = (cmd: Command | undefined): CommandLight | undefined =>
    cmd ? lights.find((light) => light.slug === cmd.slug) : undefined;

  return <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6">
    <header className="space-y-3"><div className="inline-flex items-center gap-2 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-xs text-amber-300"><Shuffle className="h-4 w-4" /> daily dispatch</div><h1 className="font-display text-3xl font-semibold text-[var(--text-heading)]">Command of the day</h1><p className="text-sm text-[var(--text-muted)]">A deterministic daily pick, plus a random command when you want another challenge.</p></header>
    <DocsGate loading={loading || !command} error={error}>
      {picked && (
        <article className="space-y-5 rounded-xl border border-[var(--terminal-green)]/40 bg-[var(--terminal-green-bg)] p-6">
          <p className="font-mono text-xs uppercase text-[var(--text-muted)]">{!randomSlug ? 'Today’s command' : 'Random command'}</p>
          <h2 className="font-mono text-4xl font-bold text-[var(--terminal-green)]">{picked.name}</h2>
          <p className="text-[var(--text)]">{picked.summary}</p>
          <code className="block rounded-lg bg-[var(--code-bg)] p-4 text-sm text-[var(--terminal-green)]">$ {picked.examples[0]?.command || picked.syntax}</code>
          <div className="flex flex-wrap gap-3">
            {lightFor(picked) && <Link to={getPathForLight(lightFor(picked)!)} className="rounded-lg bg-[var(--terminal-green)] px-4 py-2 font-mono text-sm font-bold text-[var(--bg)]">Study command</Link>}
            <button onClick={() => setRandomSlug(commands[Math.floor(Math.random() * commands.length)].slug)} className="rounded-lg border border-[var(--border)] px-4 py-2 font-mono text-sm text-[var(--text)]">Pick another</button>
          </div>
        </article>
      )}
    </DocsGate>
  </div>;
};

export const ExportImportPage = () => {
  const { user, bookmarks, notes, importData } = useAuth();
  const { progress, applyImported } = useProgress();
  const [message, setMessage] = useState('');
  const exportData = () => {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      bookmarks: [...bookmarks],
      notes: [...notes.entries()].map(([command_slug, text]) => ({ command_slug, text })),
      progress: {
        learning: progress.learning ?? {},
        terminal: progress.terminal ?? { solved: [], commandsRun: 0 },
        flashcards: progress.flashcards ?? { completes: {} },
        speeddrill: progress.speeddrill ?? { best: 0, plays: 0 },
        streak: progress.streak ?? { lastDay: '', current: 0, best: 0, totalDays: 0 },
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'linuxdocs-progress.json'; link.click(); URL.revokeObjectURL(url);
    setMessage('Progress, bookmarks, and notes exported.');
  };
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result));
        // Schema validation — an unsupported version or malformed collection
        // rejects the whole import rather than silently half-applying it.
        const problems: string[] = [];
        const version = data?.version;
        if (version !== 1 && version !== 2) {
          setMessage(`Import rejected: unknown schema version ${String(version)} (this build reads version 2).`);
          return;
        }
        const slugOk = (s: unknown) => typeof s === 'string' && s.length > 0 && s.length <= 200 && /^[a-z0-9/-]+$/.test(s);
        const bookmarksIn = Array.isArray(data.bookmarks) ? data.bookmarks : null;
        if (bookmarksIn && (!bookmarksIn.every(slugOk) || bookmarksIn.length > 2000)) problems.push('bookmarks');
        const notesIn = Array.isArray(data.notes) ? data.notes : null;
        if (notesIn && (!notesIn.every((n: unknown) => !!n && typeof n === 'object' && slugOk((n as Record<string, unknown>).command_slug) && typeof (n as Record<string, unknown>).text === 'string' && String((n as Record<string, unknown>).text).length <= 10000) || notesIn.length > 2000)) problems.push('notes');
        if (problems.length) {
          setMessage(`Import rejected: malformed ${problems.join(' and ')} in the export file.`);
          return;
        }

        if (version === 2) {
          // Schema v2: strictly-shaped per-key progress payloads; anything not
          // matching the shared shapes rejects the whole file.
          const progressIn = data.progress;
          if (!progressIn || typeof progressIn !== 'object' || Array.isArray(progressIn)) {
            setMessage('Import rejected: progress must be an object keyed by progress key.');
            return;
          }
          for (const [key, payload] of Object.entries(progressIn as Record<string, unknown>)) {
            if (!(PROGRESS_KEYS as readonly string[]).includes(key)) {
              setMessage(`Import rejected: unknown progress key "${key}".`);
              return;
            }
            if (!toSyncPayload(key as ProgressKey, payload)) {
              setMessage(`Import rejected: malformed progress payload for "${key}".`);
              return;
            }
          }
          if (!user) {
            setMessage('Sign in to import progress, bookmarks and notes.');
            return;
          }
          await importData({ version: 2, bookmarks: bookmarksIn ?? [], notes: notesIn ?? [], progress: progressIn as Record<string, unknown> });
          // Local state catches up immediately (monotone merge, never loses a side).
          applyImported(progressIn as Record<string, unknown>);
          setMessage('Progress, bookmarks, and notes imported (schema v2).');
          return;
        }

        // Schema v1 (pre-Part-2 exports): raw device store blobs ride along;
        // they are validated, applied to the synced store one-way (union/max)
        // and written to the local keys for the device-local features.
        const storePlan: [string, string][] = [
          ['practiceTerminal', 'linuxdocs.practice-terminal'],
          ['learningProgress', 'linuxdocs.learning-progress-v3'],
          ['flashcards', 'linuxdocs.flashcards'],
          ['speedDrill', 'linuxdocs.speeddrill'],
          ['streak', 'linuxdocs.streak'],
        ];
        const skipped: string[] = [];
        const parsedStores: Partial<Record<string, unknown>> = {};
        for (const [field, key] of storePlan) {
          const raw = (data as Record<string, unknown>)[field];
          if (typeof raw !== 'string') continue;
          try {
            const parsed: unknown = JSON.parse(raw);
            if (parsed === null || typeof parsed !== 'object') throw new Error('shape');
            parsedStores[key] = parsed;
            localStorage.setItem(key, raw);
          } catch {
            skipped.push(field as string);
          }
        }
        const adopted: Partial<Record<ProgressKey, unknown>> = {};
        for (const [key, blob] of Object.entries(parsedStores)) {
          const payload = toSyncPayload(key as ProgressKey, blob);
          if (payload) adopted[key as ProgressKey] = payload;
        }
        if (user) {
          await importData({ version: 1, bookmarks: bookmarksIn ?? [], notes: notesIn ?? [] });
          applyImported(adopted);
        }
        const noteBits = ['schema v1'];
        if (skipped.length) noteBits.push(`skipped corrupt store${skipped.length > 1 ? 's' : ''}: ${skipped.join(', ')}`);
        setMessage(user
          ? `Progress, bookmarks, and notes imported (${noteBits.join(' · ')}).`
          : `Local progress imported (${noteBits.join(' · ')}). Sign in to import bookmarks and notes.`);
      } catch {
        setMessage('Import rejected: invalid LinuxDocs JSON.');
      }
    };
    reader.readAsText(file);
  };
  return <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6"><header className="space-y-3"><h1 className="font-display text-3xl font-semibold text-[var(--text-heading)]">Export &amp; import</h1><p className="text-sm text-[var(--text-muted)]">Back up browser progress plus authenticated bookmarks and notes as portable JSON.</p></header><div className="grid gap-4 sm:grid-cols-2"><button onClick={exportData} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--terminal-green)]/40 bg-[var(--terminal-green-bg)] p-6 font-mono text-sm text-[var(--terminal-green)]"><Download className="h-5 w-5" /> Export progress</button><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 font-mono text-sm text-[var(--text)] hover:border-[var(--terminal-green)]"><Upload className="h-5 w-5" /> Import JSON<input type="file" accept="application/json,.json" onChange={handleImport} className="hidden" /></label></div>{!user && <p className="text-xs text-[var(--text-muted)]">Sign in to include bookmarks and notes in the import/export.</p>}{message && <p className="font-mono text-sm text-[var(--terminal-green)]">$ {message}</p>}</div>;
};
