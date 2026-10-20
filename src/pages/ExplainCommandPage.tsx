import { useMemo, useState } from 'react';
import { AlertTriangle, HelpCircle, Terminal, BookOpen, Search, Sparkles, ArrowRight, Shield } from 'lucide-react';
import { COMMANDS, getCommand, getPathForCommand } from '../data/commands';
import { Link } from 'react-router-dom';

type Explanation = { token: string; kind: 'command' | 'flag' | 'pipe' | 'argument' | 'unknown'; text: string; commandSlug?: string; commandSection?: 'linux' | 'ctf' };

function explainLine(input: string): Explanation[] {
  const pieces = input.split(/(\|\||&&|\||;)/).map((piece) => piece.trim()).filter(Boolean);
  const output: Explanation[] = [];
  for (const piece of pieces) {
    if (/^(\|\||&&|\|;)$/.test(piece) || ['|', '||', '&&', ';'].includes(piece)) {
      output.push({ token: piece, kind: 'pipe', text: piece === '|' ? 'pipes standard output (stdout) into the next command\'s standard input (stdin)' : piece === '&&' ? 'runs the next command ONLY if this command succeeds (exit code 0)' : piece === '||' ? 'runs the next command ONLY if this command fails (non-zero exit code)' : 'separates commands sequentially' });
      continue;
    }
    const tokens = piece.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const command = getCommand(tokens[0] || '');
    if (!command) {
      tokens.forEach((token) => output.push({ token, kind: 'unknown', text: 'Unknown token - this command is not in the LinuxDocs dataset. Try searching for similar commands!' }));
      continue;
    }
    output.push({ token: command.name, kind: 'command', text: `${command.summary} (Category: ${command.category})`, commandSlug: command.slug, commandSection: command.section });
    for (const token of tokens.slice(1)) {
      if (token.startsWith('-')) {
        const option = command.options.find((item) => item.flag.split(',').some((flag) => flag.trim() === token) || item.flag.includes(token.replace(/^-+/, '')));
        if (option) {
          output.push({ token, kind: 'flag', text: option.description + (option.example ? ` Example: ${option.example}` : '') });
        } else {
          output.push({ token, kind: 'unknown', text: `Unknown flag '${token}' for ${command.name} - not documented in our dataset` });
        }
      } else {
        output.push({ token, kind: 'argument', text: 'Argument/filename/target passed to this command. Meaning depends on context and the command\'s syntax.' });
      }
    }
  }
  return output;
}

const EXAMPLES = [
  'ls -la /home/user',
  'grep -rn "error" /var/log | tail -n 50',
  'find . -name "*.sh" -type f | xargs chmod +x',
  'ps aux | grep nginx | head -n 5',
  'cat file.txt | sort | uniq -c | sort -nr | head -10',
  'curl -I https://example.com',
  'tar -czvf backup.tar.gz ~/Documents',
  'chmod 755 script.sh && ./script.sh'
];

export const ExplainCommandPage = () => {
  const [input, setInput] = useState('grep -rn "error" /var/log | head -n 20');
  const explanations = useMemo(() => explainLine(input), [input]);
  const knownCommands = COMMANDS.length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-xs text-[var(--terminal-green)]">
            <Terminal className="h-4 w-4" /> Enhanced Parser • Dataset-Powered
          </div>
          <div className="inline-flex items-center gap-2 rounded border border-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--text-muted)]">
            <BookOpen className="h-4 w-4" /> {knownCommands}+ commands in dataset
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[var(--text-heading)] tracking-tight">Explain Any Command</h1>
          <p className="mt-3 text-lg text-[var(--text-muted)] max-w-3xl">Paste any shell one-liner with pipes, logical operators (&amp;&amp;, ||), or semicolons. Get a detailed breakdown of every command, flag, and operator - explained in plain English.</p>
        </div>
      </header>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg)] p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <label htmlFor="command-input" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[var(--terminal-green)]">
            <Sparkles className="h-4 w-4" /> Enter your shell command
          </label>
          <span className="font-mono text-xs text-[var(--text-muted)]">{input.length} chars</span>
        </div>
        <textarea 
          id="command-input" 
          value={input} 
          onChange={(event) => setInput(event.target.value)} 
          rows={6} 
          className="w-full rounded-lg border-2 border-[var(--border)] bg-[var(--code-bg)] p-5 font-mono text-sm sm:text-base text-[var(--terminal-green)] focus:border-[var(--terminal-green)] focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)]/20 transition-all resize-none" 
          spellCheck={false}
          placeholder="e.g., find . -name '*.log' | xargs grep -l ERROR | wc -l"
        />
        <div>
          <p className="font-mono text-xs text-[var(--text-muted)] mb-2">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => setInput(ex)}
                className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--bg-surface-elevated)] font-mono text-xs text-[var(--text)] hover:border-[var(--terminal-green)] hover:text-[var(--terminal-green)] transition-colors"
              >
                {ex.length > 40 ? ex.slice(0, 37) + '...' : ex}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-live="polite">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text-heading)] flex items-center gap-3">
            <Search className="h-6 w-6 text-[var(--terminal-green)]" />
            Command Breakdown
          </h2>
          <span className="font-mono text-xs text-[var(--text-muted)]">{explanations.length} token{explanations.length !== 1 ? 's' : ''} analyzed</span>
        </div>
        {explanations.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
            <p className="font-mono text-sm text-[var(--text-muted)]">$ waiting for input<span className="blinking">_</span></p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Start typing a command above to see the breakdown</p>
          </div>
        ) : (
          <div className="space-y-3">
            {explanations.map((item, index) => (
              <div 
                key={`${item.token}-${index}`} 
                className={`group relative overflow-hidden rounded-xl border p-5 transition-all hover:shadow-lg ${
                  item.kind === 'unknown' 
                    ? 'border-red-500/40 bg-gradient-to-r from-red-500/10 to-transparent' 
                    : item.kind === 'pipe'
                    ? 'border-amber-400/40 bg-gradient-to-r from-amber-400/10 to-transparent'
                    : item.kind === 'command'
                    ? 'border-[var(--terminal-green)]/40 bg-gradient-to-r from-[var(--terminal-green-bg)] to-transparent'
                    : 'border-[var(--border)] bg-gradient-to-r from-[var(--bg-surface)] to-transparent'
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
                  <div className="flex items-center gap-3 sm:min-w-[200px]">
                    <code className={`font-mono text-base sm:text-lg font-bold ${
                      item.kind === 'unknown' ? 'text-red-400' 
                      : item.kind === 'pipe' ? 'text-amber-400' 
                      : item.kind === 'command' ? 'text-[var(--terminal-green)]'
                      : item.kind === 'flag' ? 'text-cyan-400'
                      : 'text-[var(--text)]'
                    }`}>
                      {item.token}
                    </code>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wide ${
                      item.kind === 'unknown' ? 'bg-red-500/20 text-red-400'
                      : item.kind === 'pipe' ? 'bg-amber-400/20 text-amber-400'
                      : item.kind === 'command' ? 'bg-[var(--terminal-green)]/20 text-[var(--terminal-green)]'
                      : item.kind === 'flag' ? 'bg-cyan-400/20 text-cyan-400'
                      : 'bg-[var(--border)] text-[var(--text-muted)]'
                    }`}>
                      {item.kind}
                    </span>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm sm:text-base text-[var(--text)] leading-relaxed">{item.text}</p>
                    {item.kind === 'command' && item.commandSlug && (() => {
                      const command = getCommand(item.commandSlug);
                      if (!command) return null;
                      return (
                        <Link
                          to={getPathForCommand(command)}
                          className={`inline-flex items-center gap-1.5 text-sm hover:underline font-mono ${command.section === 'ctf' ? 'text-[var(--ctf-red)]' : 'text-[var(--terminal-green)]'}`}
                        >
                          {command.section === 'ctf' && <Shield className="h-3.5 w-3.5" />}
                          View full documentation <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      );
                    })()}
                  </div>
                  {item.kind === 'unknown' && <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" aria-label="Unknown token" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm text-[var(--text-muted)]">
        <HelpCircle className="h-5 w-5 text-[var(--terminal-green)] shrink-0" />
        <p><strong className="text-[var(--text)]">Dataset-only explanations:</strong> We only explain commands and flags that exist in the LinuxDocs dataset. Unknown tokens are never guessed or inferred - encouraging you to look them up and learn properly.</p>
      </div>
    </div>
  );
};
