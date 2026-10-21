import { useState, type ChangeEvent } from 'react';
import { ArrowRight, Download, GitCompare, Shuffle, Upload, Info } from 'lucide-react';
import { allCommands, getPathForCommand } from '../data/commands';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const allCmdsSorted = [...allCommands].sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
const linuxCommands = allCommands.filter((command) => command.section === 'linux');

export const ComparePage = () => {
  const [leftSlug, setLeftSlug] = useState('grep');
  const [rightSlug, setRightSlug] = useState('sed');
  const [viewAll, setViewAll] = useState(false);
  const left = allCommands.find((command) => command.slug === leftSlug) || linuxCommands[0];
  const right = allCommands.find((command) => command.slug === rightSlug) || linuxCommands[1];
  const cmdList = viewAll ? allCmdsSorted : linuxCommands;
  const select = (value: string, onChange: (value: string) => void) => <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm text-[var(--text)] focus:border-[var(--terminal-green)] focus:outline-none">{cmdList.map((command) => <option key={command.slug} value={command.slug}>{command.section === 'ctf' ? '[CTF]' : '[LINUX]'} {command.name}</option>)}</select>;
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6"><header className="space-y-4"><div className="flex flex-wrap items-center gap-3"><div className="inline-flex items-center gap-2 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-xs text-[var(--terminal-green)]"><GitCompare className="h-4 w-4" /> Side-by-Side Comparison</div><button onClick={() => setViewAll(!viewAll)} className="inline-flex items-center gap-2 rounded border border-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--terminal-green)] hover:border-[var(--terminal-green)]">{viewAll ? 'Show Linux only' : 'Show all commands (Linux + CTF)'}</button></div><div><h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--text-heading)] tracking-tight">Compare Commands</h1><p className="mt-3 text-lg text-[var(--text-muted)] max-w-3xl">Compare purpose, syntax, options, use cases, examples, and related commands side-by-side. Perfect for understanding differences between similar tools.</p></div></header><div className="grid gap-6 lg:grid-cols-2"><article className="space-y-4 rounded-xl border-2 border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg)] p-6 shadow-lg"><label className="block space-y-2"><span className="font-mono text-xs uppercase tracking-widest text-[var(--terminal-green)]">Command A</span>{select(leftSlug, setLeftSlug)}</label><CommandColumn command={left} /></article><article className="space-y-4 rounded-xl border-2 border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg)] p-6 shadow-lg"><label className="block space-y-2"><span className="font-mono text-xs uppercase tracking-widest text-[var(--terminal-green)]">Command B</span>{select(rightSlug, setRightSlug)}</label><CommandColumn command={right} /></article></div><ComparisonSummary left={left} right={right} /></div>;
};

const CommandColumn = ({ command }: { command: (typeof allCommands)[number] }) => <div className="space-y-5"><div className="pb-4 border-b border-[var(--border)]"><div className="flex items-center gap-2 mb-2"><h2 className="font-display text-3xl font-semibold text-[var(--terminal-green)]">{command.name}</h2><span className="px-2 py-0.5 rounded text-xs font-mono bg-[var(--border)] text-[var(--text-muted)]">{command.section}</span></div><p className="text-sm text-[var(--text)] leading-relaxed">{command.summary}</p><p className="mt-2 text-xs text-[var(--text-muted)]">Category: <span className="text-[var(--text)]">{command.category}</span></p></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Description</p><p className="text-sm text-[var(--text)] leading-relaxed">{command.description}</p></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">Syntax</p><code className="block rounded-lg bg-[var(--code-bg)] p-4 text-sm text-[var(--terminal-green)] font-mono break-all">{command.syntax}</code></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Options / Flags ({command.options.length})</p><ul className="space-y-2">{command.options.length > 0 ? command.options.map((option) => <li key={option.flag} className="flex gap-3 text-sm"><code className="text-[var(--terminal-green)] font-mono shrink-0">{option.flag}</code><span className="text-[var(--text)]">{option.description}{option.example ? <span className="text-[var(--text-muted)]"> — {option.example}</span> : null}</span></li>) : <li className="text-xs text-[var(--text-muted)] italic">No options documented</li>}</ul></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Use Cases</p><div className="flex flex-wrap gap-2">{command.useCases.map((use) => <span key={use} className="px-2.5 py-1 rounded border border-[var(--border)] text-xs text-[var(--text)]">{use}</span>)}</div></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Examples ({command.examples.length})</p><div className="space-y-3">{command.examples.map((ex, idx) => <div key={idx} className="rounded-lg bg-[var(--code-bg)] p-3 space-y-1.5"><div className="flex items-center justify-between"><span className="text-xs text-[var(--terminal-green)] font-mono">{ex.title}</span></div><code className="block text-xs text-[var(--terminal-green)] font-mono break-all">$ {ex.command}</code>{ex.explanation && <p className="text-xs text-[var(--text-muted)]">{ex.explanation}</p>}</div>)}</div></div><div><p className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)] mb-3">Related Commands</p><div className="flex flex-wrap gap-2">{command.related.map((rel) => { const relCmd = allCommands.find(c => c.slug === rel); return relCmd ? <Link key={rel} to={getPathForCommand(relCmd)} className="px-2.5 py-1 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border)] font-mono text-xs text-[var(--terminal-green)] hover:border-[var(--terminal-green)]">{relCmd.name}</Link> : <span key={rel} className="px-2.5 py-1 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border)] font-mono text-xs text-[var(--text-muted)]">{rel}</span>; })}</div></div><Link to={getPathForCommand(command)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--terminal-green)] font-mono text-sm font-bold text-[var(--bg)] hover:opacity-90 transition-opacity">Open Full Documentation <ArrowRight className="h-4 w-4" /></Link></div>;

const ComparisonSummary = ({ left, right }: { left: (typeof allCommands)[number], right: (typeof allCommands)[number] }) => (
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
  const dayIndex = Math.floor(Date.now() / 86400000) % allCommands.length;
  const command = allCommands[dayIndex];
  const [random, setRandom] = useState(command);
  return <div className="mx-auto max-w-3xl space-y-8 px-4 py-12 sm:px-6"><header className="space-y-3"><div className="inline-flex items-center gap-2 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-xs text-amber-300"><Shuffle className="h-4 w-4" /> daily dispatch</div><h1 className="font-display text-3xl font-semibold text-[var(--text-heading)]">Command of the day</h1><p className="text-sm text-[var(--text-muted)]">A deterministic daily pick, plus a random command when you want another challenge.</p></header><article className="space-y-5 rounded-xl border border-[var(--terminal-green)]/40 bg-[var(--terminal-green-bg)] p-6"><p className="font-mono text-xs uppercase text-[var(--text-muted)]">{random === command ? 'Today’s command' : 'Random command'}</p><h2 className="font-mono text-4xl font-bold text-[var(--terminal-green)]">{random.name}</h2><p className="text-[var(--text)]">{random.summary}</p><code className="block rounded-lg bg-[var(--code-bg)] p-4 text-sm text-[var(--terminal-green)]">$ {random.examples[0]?.command || random.syntax}</code><div className="flex flex-wrap gap-3"><Link to={getPathForCommand(random)} className="rounded-lg bg-[var(--terminal-green)] px-4 py-2 font-mono text-sm font-bold text-[var(--bg)]">Study command</Link><button onClick={() => setRandom(allCommands[Math.floor(Math.random() * allCommands.length)])} className="rounded-lg border border-[var(--border)] px-4 py-2 font-mono text-sm text-[var(--text)]">Pick another</button></div></article></div>;
};

export const ExportImportPage = () => {
  const { user, bookmarks, notes, importData } = useAuth();
  const [message, setMessage] = useState('');
  const exportData = () => { const data = { version: 1, exportedAt: new Date().toISOString(), bookmarks: [...bookmarks], notes: [...notes.entries()].map(([command_slug, text]) => ({ command_slug, text })), practiceTerminal: localStorage.getItem('linuxdocs.practice-terminal'), learningProgress: localStorage.getItem('linuxdocs.learning-progress-v3'), flashcards: localStorage.getItem('linuxdocs.flashcards'), speedDrill: localStorage.getItem('linuxdocs.speeddrill'), streak: localStorage.getItem('linuxdocs.streak') }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'linuxdocs-progress.json'; link.click(); URL.revokeObjectURL(url); setMessage('Progress, bookmarks, and notes exported.'); };
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
        if (data?.version !== 1) {
          setMessage(`Import rejected: unknown schema version ${String(data?.version)} (this build reads version 1).`);
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
        // Device progress stores are swapped only when they parse to their
        // documented shapes; a corrupt blob is skipped and reported, never crashes.
        const storePlan: [string, string, (v: unknown) => boolean][] = [
          ['practiceTerminal', 'linuxdocs.practice-terminal', (v) => v === null || (typeof v === 'object' && v !== null)],
          ['learningProgress', 'linuxdocs.learning-progress-v3', (v) => v === null || (typeof v === 'object' && v !== null)],
          ['flashcards', 'linuxdocs.flashcards', (v) => v === null || (typeof v === 'object' && v !== null)],
          ['speedDrill', 'linuxdocs.speeddrill', (v) => v === null || (typeof v === 'object' && v !== null)],
          ['streak', 'linuxdocs.streak', (v) => v === null || (typeof v === 'object' && v !== null)],
        ];
        const skipped: string[] = [];
        for (const [field, key, shapeOk] of storePlan) {
          const raw = (data as Record<string, unknown>)[field];
          if (typeof raw === 'string') {
            let restores = false;
            try { const parsed: unknown = JSON.parse(raw); if (shapeOk(parsed)) { restores = true; localStorage.setItem(key, raw); } } catch { restores = false; }
            if (!restores) skipped.push(field as string);
          }
        }
        if (user && (bookmarksIn?.length || notesIn?.length)) await importData({ bookmarks: bookmarksIn ?? [], notes: notesIn ?? [] });
        const noteBits = [`schema v1`];
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
