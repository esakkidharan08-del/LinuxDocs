import { useMemo, useState } from 'react';
import { AlertTriangle, HelpCircle, Terminal } from 'lucide-react';
import { COMMANDS, getCommand } from '../data/commands';

type Explanation = { token: string; kind: 'command' | 'flag' | 'pipe' | 'argument' | 'unknown'; text: string };

function explainLine(input: string): Explanation[] {
  const pieces = input.split(/(\|\||&&|\||;)/).map((piece) => piece.trim()).filter(Boolean);
  const output: Explanation[] = [];
  for (const piece of pieces) {
    if (/^(\|\||&&|\|️|\|;)$/.test(piece) || ['|', '||', '&&', ';'].includes(piece)) {
      output.push({ token: piece, kind: 'pipe', text: piece === '|' ? 'pipes standard output into the next command' : piece === '&&' ? 'runs the next command only when this succeeds' : piece === '||' ? 'runs the next command only when this fails' : 'separates commands' });
      continue;
    }
    const tokens = piece.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const command = getCommand(tokens[0] || '');
    if (!command) {
      tokens.forEach((token) => output.push({ token, kind: 'unknown', text: 'unknown token: no matching command exists in the LinuxDocs dataset' }));
      continue;
    }
    output.push({ token: command.name, kind: 'command', text: command.summary });
    for (const token of tokens.slice(1)) {
      const option = command.options.find((item) => item.flag.split(',').some((flag) => flag.trim() === token));
      if (token.startsWith('-') && option) output.push({ token, kind: 'flag', text: option.description });
      else if (token.startsWith('-')) output.push({ token, kind: 'unknown', text: `unknown ${command.name} flag: not present in the dataset` });
      else output.push({ token, kind: 'argument', text: 'argument passed to the command; its meaning depends on this command’s syntax' });
    }
  }
  return output;
}

export const ExplainCommandPage = () => {
  const [input, setInput] = useState('grep -rin "error" /var/log | head -n 20');
  const explanations = useMemo(() => explainLine(input), [input]);
  const knownCommands = COMMANDS.length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-xs text-[var(--terminal-green)]"><Terminal className="h-4 w-4" /> parser: dataset-only</div>
        <h1 className="font-mono text-3xl font-bold text-[var(--text-heading)]">Explain This Command</h1>
        <p className="text-sm text-[var(--text-muted)]">Paste a one-liner, including pipes. LinuxDocs explains only commands and flags present in its {knownCommands}-entry dataset.</p>
      </header>
      <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
        <label htmlFor="command-input" className="font-mono text-xs uppercase tracking-wide text-[var(--text-muted)]">One-liner</label>
        <textarea id="command-input" value={input} onChange={(event) => setInput(event.target.value)} rows={4} className="w-full rounded-lg border border-[var(--border)] bg-[var(--code-bg)] p-4 font-mono text-sm text-[var(--terminal-green)] focus:border-[var(--terminal-green)] focus:outline-none" spellCheck={false} />
      </section>
      <section className="space-y-3" aria-live="polite">
        <h2 className="font-mono text-xl font-bold text-[var(--text-heading)]">Breakdown</h2>
        {explanations.length === 0 ? <p className="font-mono text-sm text-[var(--text-muted)]">$ waiting for input<span className="blinking">_</span></p> : explanations.map((item, index) => (
          <div key={`${item.token}-${index}`} className={`flex flex-col gap-1 rounded-lg border p-4 sm:flex-row sm:items-start sm:gap-4 ${item.kind === 'unknown' ? 'border-red-500/40 bg-red-500/10' : 'border-[var(--border)] bg-[var(--bg-surface)]'}`}>
            <code className={`font-mono text-sm ${item.kind === 'unknown' ? 'text-red-400' : item.kind === 'pipe' ? 'text-amber-400' : 'text-[var(--terminal-green)]'}`}>{item.token}</code>
            <span className="text-sm text-[var(--text)]">{item.text}</span>
            {item.kind === 'unknown' && <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-label="Unknown token" />}
          </div>
        ))}
      </section>
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><HelpCircle className="h-4 w-4" /> Unknown tokens are never inferred or guessed.</div>
    </div>
  );
};
