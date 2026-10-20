import { useMemo, useState } from 'react';
import { Check, Clipboard, Printer } from 'lucide-react';
import { allCommands, LINUX_CATEGORIES } from '../data/commands';

export const CheatSheetsPage = () => {
  const [category, setCategory] = useState('file-and-directory');
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const commands = useMemo(() => allCommands.filter((command) => command.section === 'linux' && command.category === category && `${command.name} ${command.summary} ${command.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [category, query]);
  const categoryInfo = LINUX_CATEGORIES.find((item) => item.id === category);

  const copy = async (command: string) => { await navigator.clipboard.writeText(command); setCopied(command); window.setTimeout(() => setCopied(null), 1200); };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 print:px-0">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div className="space-y-3"><div className="inline-flex rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-xs text-[var(--terminal-green)]">quick reference</div><h1 className="font-display text-3xl font-semibold text-[var(--text-heading)]">Cheat sheets</h1><p className="text-sm text-[var(--text-muted)]">A focused, printable command reference built from the LinuxDocs dataset.</p></div><button onClick={() => window.print()} className="inline-flex items-center gap-2 self-start rounded-lg border border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--terminal-green)] print:hidden"><Printer className="h-4 w-4" /> print sheet</button></header>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] print:hidden"><select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3 font-mono text-sm text-[var(--text)]">{LINUX_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter commands, summaries, or tags" className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-3 text-sm text-[var(--text)] focus:border-[var(--terminal-green)] focus:outline-none" /></div>
      <section className="space-y-4"><div><h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">{categoryInfo?.name}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{categoryInfo?.description}</p></div><div className="overflow-hidden rounded-xl border border-[var(--border)]"><div className="grid grid-cols-[minmax(7rem,1fr)_minmax(0,2fr)_auto] gap-3 border-b border-[var(--border)] bg-[var(--bg-surface-elevated)] px-4 py-3 font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]"><span>Command</span><span>Purpose / example</span><span /></div>{commands.map((command) => { const example = command.examples[0]?.command || command.name; return <div key={command.slug} className="grid grid-cols-[minmax(7rem,1fr)_minmax(0,2fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-4 last:border-0"><code className="font-mono font-bold text-[var(--terminal-green)]">{command.name}</code><div><p className="text-sm text-[var(--text)]">{command.summary}</p><code className="mt-1 block break-all font-mono text-xs text-[var(--text-muted)]">$ {example}</code></div><button onClick={() => copy(example)} className="rounded border border-[var(--border)] p-2 text-[var(--text-muted)] hover:text-[var(--terminal-green)]" aria-label={`Copy example for ${command.name}`}>{copied === example ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}</button></div>; })}</div>{commands.length === 0 && <p className="py-8 text-center font-mono text-sm text-[var(--text-muted)]">No commands match this filter.</p>}</section>
    </div>
  );
};
