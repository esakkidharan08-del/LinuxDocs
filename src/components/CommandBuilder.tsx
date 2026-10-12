import { useState } from 'react';
import { Check, Copy, SlidersHorizontal } from 'lucide-react';
import type { BuilderSpec } from '../data/commandBuilders';

export const CommandBuilder = ({ spec }: { spec: BuilderSpec }) => {
  const initialValues = Object.fromEntries(spec.fields.map((field) => [field.id, field.defaultValue || '']));
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const command = spec.build(values, flags);

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="space-y-5 p-5 rounded-xl border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)]" aria-labelledby="command-builder-title">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="w-5 h-5 text-[var(--terminal-green)]" />
        <h2 id="command-builder-title" className="font-mono text-xl font-bold text-[var(--text-heading)]">Command Builder</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {spec.fields.map((field) => (
          <label key={field.id} className="space-y-1 font-mono text-xs text-[var(--text-muted)]">
            <span>{field.label}</span>
            <input value={values[field.id]} placeholder={field.placeholder} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--terminal-green)] focus:outline-none" />
          </label>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {spec.flags.map((item) => (
          <label key={item.flag} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-xs text-[var(--text)]">
            <input type="checkbox" checked={flags.has(item.flag)} onChange={() => setFlags((current) => { const next = new Set(current); next.has(item.flag) ? next.delete(item.flag) : next.add(item.flag); return next; })} className="accent-[var(--terminal-green)]" />
            {item.label} <code className="ml-auto text-[var(--terminal-green)]">{item.flag}</code>
          </label>
        ))}
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--code-bg)] p-4">
        <code className="flex-1 break-all font-mono text-sm text-[var(--terminal-green)]">$ {command}</code>
        <button onClick={copy} className="shrink-0 rounded border border-[var(--border)] p-2 text-[var(--text-muted)] hover:text-[var(--terminal-green)]" aria-label="Copy assembled command">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
      </div>
      <div className="space-y-1 text-xs text-[var(--text-muted)]">
        <p className="font-mono uppercase tracking-wide text-[var(--text)]">Plain-English breakdown</p>
        {spec.explain(values, flags).map((line) => <p key={line}>$ {line}</p>)}
      </div>
    </section>
  );
};
