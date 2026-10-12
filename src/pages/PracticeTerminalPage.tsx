import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { RotateCcw, ShieldCheck, Terminal } from 'lucide-react';

type Line = { input?: string; output: string; tone?: 'error' | 'muted' };
const STORAGE_KEY = 'linuxdocs.practice-terminal';
const welcome: Line[] = [
  { output: 'LinuxDocs practice shell. No commands leave your browser.' },
  { output: 'Type help to see the safe command set.', tone: 'muted' }
];

const runCommand = (raw: string): string[] => {
  const input = raw.trim();
  if (!input) return [];
  const [name, ...args] = input.split(/\s+/);
  switch (name) {
    case 'help': return ['Available: clear, echo, help, ls, man, pwd, reset, whoami', 'This terminal simulates output locally and never executes system commands.'];
    case 'pwd': return ['/home/learner'];
    case 'whoami': return ['learner'];
    case 'date': return [new Date().toString()];
    case 'echo': return [args.join(' ')];
    case 'ls': return ['bin  exercises  notes  README.md'];
    case 'cat': return args[0] === 'README.md' ? ['Welcome to the LinuxDocs practice terminal.', 'Try safe commands such as pwd, ls, echo, and man.'] : ['cat: file is not available in the practice filesystem'];
    case 'man': return args[0] ? [`MANUAL: ${args[0]}`, 'Use the LinuxDocs command reference for the complete syntax and examples.'] : ['What manual page do you want?'];
    case 'clear': return ['__CLEAR__'];
    case 'reset': return ['__RESET__'];
    default: return [`${name}: command not available in the browser-only practice terminal`];
  }
};

export const PracticeTerminalPage = () => {
  const [lines, setLines] = useState<Line[]>(welcome);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setLines(JSON.parse(saved) as Line[]); } catch { localStorage.removeItem(STORAGE_KEY); }
    }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)); }, [lines]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const command = input.trim();
    if (!command) return;
    const result = runCommand(command);
    if (result.includes('__RESET__')) {
      setLines(welcome);
    } else if (result.includes('__CLEAR__')) {
      setLines([]);
    } else {
      setLines((current) => [...current, { input: command, output: '' }, ...result.map((output) => ({ output, tone: output.includes('not available') ? 'error' as const : undefined }))]);
    }
    setInput('');
  };

  const reset = () => { setLines(welcome); setInput(''); inputRef.current?.focus(); };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-xs text-[var(--terminal-green)]"><ShieldCheck className="h-4 w-4" /> local sandbox</div>
        <h1 className="font-mono text-3xl font-bold text-[var(--text-heading)]">Practice Terminal</h1>
        <p className="text-sm text-[var(--text-muted)]">A safe, simulated shell for learning command structure. It cannot access your files, network, or operating system.</p>
      </header>
      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--code-bg)] shadow-lg" onClick={() => inputRef.current?.focus()}>
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface-elevated)] px-4 py-3">
          <div className="flex items-center gap-2"><Terminal className="h-4 w-4 text-[var(--terminal-green)]" /><span className="font-mono text-xs text-[var(--text-muted)]">linuxdocs@browser:~</span></div>
          <button onClick={reset} className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--terminal-green)]"><RotateCcw className="h-3 w-3" /> reset</button>
        </div>
        <div className="min-h-[28rem] space-y-1 overflow-auto p-5 font-mono text-sm">
          {lines.map((line, index) => <div key={`${index}-${line.output}`} className={line.tone === 'error' ? 'text-red-400' : line.tone === 'muted' ? 'text-[var(--text-muted)]' : 'text-[var(--terminal-green)]'}>{line.input && <><span className="text-[var(--text-muted)]">learner@browser:~$ </span>{line.input}</>}{line.output && !line.input && <span>{line.output}</span>}</div>)}
          <form onSubmit={submit} className="flex items-center"><span className="mr-2 text-[var(--text-muted)]">learner@browser:~$</span><input ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[var(--terminal-green)] outline-none" aria-label="Practice terminal command" autoComplete="off" spellCheck={false} /></form>
        </div>
      </section>
      <p className="font-mono text-xs text-[var(--text-muted)]">Progress is saved only in this browser under local storage. It is not uploaded or shared.</p>
    </div>
  );
};
