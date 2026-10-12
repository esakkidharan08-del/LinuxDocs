import { useEffect, useState } from 'react';
import { BookOpen, Check, ChevronRight, RotateCcw } from 'lucide-react';

type Question = { prompt: string; choices: string[]; answer: number; explanation: string };
type Path = { id: string; title: string; description: string; commands: string[]; questions: Question[] };

const paths: Path[] = [
  { id: 'shell-basics', title: 'Shell Basics', description: 'Build confidence with navigation, files, and safe inspection.', commands: ['pwd', 'ls', 'cd', 'cat'], questions: [
    { prompt: 'Which command prints the current working directory?', choices: ['pwd', 'cd', 'ls', 'whoami'], answer: 0, explanation: 'pwd means print working directory.' },
    { prompt: 'Which command lists directory contents?', choices: ['cat', 'ls', 'touch', 'man'], answer: 1, explanation: 'ls lists files and directories.' }
  ] },
  { id: 'text-tools', title: 'Text Processing', description: 'Search and transform text with composable Unix tools.', commands: ['grep', 'sed', 'awk', 'sort'], questions: [
    { prompt: 'Which tool searches input for matching text?', choices: ['grep', 'mkdir', 'chmod', 'tar'], answer: 0, explanation: 'grep prints lines matching a pattern.' },
    { prompt: 'What does a pipe connect?', choices: ['Two files', 'One command output to another input', 'Two users', 'A disk and a mount'], answer: 1, explanation: 'The pipe sends standard output to the next command’s standard input.' }
  ] },
  { id: 'system-safety', title: 'System Safety', description: 'Understand permissions and preview changes before applying them.', commands: ['chmod', 'chown', 'sudo', 'rsync'], questions: [
    { prompt: 'What does chmod change?', choices: ['File permissions', 'File contents', 'The hostname', 'A process ID'], answer: 0, explanation: 'chmod modifies permission bits.' },
    { prompt: 'Which rsync option previews changes without applying them?', choices: ['-a', '-v', '-n', '--delete'], answer: 2, explanation: '-n is the dry-run option.' }
  ] }
];

const STORAGE_KEY = 'linuxdocs.learning-progress';
type Progress = Record<string, { score: number; completed: boolean }>;

export const LearningPage = () => {
  const [selected, setSelected] = useState(paths[0]);
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress>({});
  const question = selected.questions[step];

  useEffect(() => { const saved = localStorage.getItem(STORAGE_KEY); if (saved) { try { setProgress(JSON.parse(saved) as Progress); } catch { localStorage.removeItem(STORAGE_KEY); } } }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }, [progress]);

  const choosePath = (path: Path) => { setSelected(path); setStep(0); setChoice(null); };
  const answer = (index: number) => {
    if (choice !== null) return;
    setChoice(index);
    if (index === question.answer) setProgress((current) => ({ ...current, [selected.id]: { score: (current[selected.id]?.score || 0) + 1, completed: false } }));
  };
  const next = () => { if (step < selected.questions.length - 1) { setStep(step + 1); setChoice(null); } else { setProgress((current) => ({ ...current, [selected.id]: { ...current[selected.id], completed: true } })); } };
  const reset = () => { setProgress((current) => ({ ...current, [selected.id]: { score: 0, completed: false } })); setStep(0); setChoice(null); };
  const done = progress[selected.id]?.completed;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-3"><div className="inline-flex items-center gap-2 rounded border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-xs text-[var(--terminal-green)]"><BookOpen className="h-4 w-4" /> learning paths</div><h1 className="font-mono text-3xl font-bold text-[var(--text-heading)]">Learn by Doing</h1><p className="text-sm text-[var(--text-muted)]">Choose a focused path, review the command set, and test your understanding. Progress stays in this browser.</p></header>
      <div className="grid gap-4 md:grid-cols-3">{paths.map((path) => <button key={path.id} onClick={() => choosePath(path)} className={`rounded-xl border p-5 text-left transition-colors ${selected.id === path.id ? 'border-[var(--terminal-green)] bg-[var(--terminal-green-bg)]' : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--terminal-green)]/60'}`}><div className="flex items-center justify-between"><h2 className="font-mono font-bold text-[var(--text-heading)]">{path.title}</h2>{progress[path.id]?.completed && <Check className="h-4 w-4 text-[var(--terminal-green)]" />}</div><p className="mt-2 text-sm text-[var(--text-muted)]">{path.description}</p><div className="mt-4 flex flex-wrap gap-1">{path.commands.map((command) => <code key={command} className="rounded bg-[var(--code-bg)] px-2 py-1 text-xs text-[var(--terminal-green)]">{command}</code>)}</div></button>)}</div>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-7"><div className="flex items-center justify-between gap-4"><div><p className="font-mono text-xs text-[var(--text-muted)]">QUESTION {step + 1} / {selected.questions.length}</p><h2 className="mt-2 text-xl font-bold text-[var(--text-heading)]">{question.prompt}</h2></div><button onClick={reset} className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--terminal-green)]"><RotateCcw className="h-3 w-3" /> reset</button></div><div className="mt-6 grid gap-3">{question.choices.map((item, index) => <button key={item} onClick={() => answer(index)} className={`rounded-lg border p-4 text-left text-sm ${choice === null ? 'border-[var(--border)] hover:border-[var(--terminal-green)]' : index === question.answer ? 'border-[var(--terminal-green)] bg-[var(--terminal-green-bg)]' : choice === index ? 'border-red-500/50 bg-red-500/10' : 'border-[var(--border)] opacity-60'}`} disabled={choice !== null}>{item}</button>)}</div>{choice !== null && <div className="mt-5 rounded-lg bg-[var(--code-bg)] p-4 text-sm text-[var(--text-muted)]"><strong className="text-[var(--text)]">{choice === question.answer ? 'Correct. ' : 'Not quite. '}</strong>{question.explanation}</div>}{done ? <p className="mt-5 font-mono text-sm text-[var(--terminal-green)]">Path complete. Score: {progress[selected.id]?.score || 0}/{selected.questions.length}.</p> : choice !== null && <button onClick={next} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-4 py-2 font-mono text-sm font-bold text-[var(--bg)]">{step === selected.questions.length - 1 ? 'Finish path' : 'Next question'} <ChevronRight className="h-4 w-4" /></button>}</section>
    </div>
  );
};
