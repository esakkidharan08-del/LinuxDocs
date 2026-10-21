import { useState, useEffect } from 'react';
import { Terminal, Shield, ArrowRight, Command, FileText, GitCompare, GraduationCap, Layers, Zap, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COMMANDS, LINUX_CATEGORIES, CTF_DOMAINS } from '../data/commands';
import SocialFlipButton from '../components/ui/SocialFlipButton';

const SAMPLE_COMMANDS = [
  { cmd: 'nmap -sC -sV 10.10.11.120', output: 'PORT 22/tcp open ssh\nPORT 80/tcp open http' },
  { cmd: 'grep -rn "TODO" src/', output: 'src/App.tsx:14: // TODO: refactor\nsrc/main.tsx:5: // TODO: config' },
  { cmd: 'sqlmap -u "http://target.htb/vuln.php?id=1" --dbs', output: '[INFO] fetching current database: ctf_db' },
  { cmd: 'tar -czvf backup.tar.gz /var/www/', output: 'tar: Removing leading / from member names\nBackup completed successfully.' },
  {
    cmd: 'journalctl -u nginx.service -n 5',
    output: 'Oct 12 10:00:01 server nginx[120]: Started A high performance web server.',
  },
];

const TOOLS = [
  { to: '/explain', icon: Command, label: 'Explain a command', blurb: 'Paste a one-liner and see each token accounted for.' },
  { to: '/practice-terminal', icon: Terminal, label: 'Practice terminal', blurb: 'A safe simulated shell with mission levels, minus the risk.' },
  { to: '/learn', icon: GraduationCap, label: 'Learning paths', blurb: 'Two stages, eight paths, quizzes with a strict cap of ten questions.' },
  { to: '/flashcards', icon: Layers, label: 'Flashcards', blurb: 'Flip through command decks and lock the vocabulary into memory.' },
  { to: '/speed-drill', icon: Zap, label: 'Speed drill', blurb: 'Sixty seconds of rapid questions, invented fresh from the dataset every round.' },
  { to: '/compare', icon: GitCompare, label: 'Compare commands', blurb: 'Put two utilities side by side, flags and all.' },
  { to: '/cheat-sheets', icon: FileText, label: 'Cheat sheets', blurb: 'Printable one-pagers per category, searchable and ready for the printer.' },
  { to: '/command-of-the-day', icon: CalendarDays, label: 'Command of the day', blurb: 'A fresh command every day, deterministic per date so everyone sees the same one.' },
];

// Hairline dividers between the tool tiles. Each tile paints its own
// border-r / border-b instead of the container faking lines with its
// background — so an unfilled cell can never render as a solid block (any
// leftover cell simply shows the page background). Every edge is drawn only
// when a neighbour exists across it at the active breakpoint (1 column on
// mobile, 2 on sm, 4 on lg), which keeps trailing edges clean for any tile
// count: the current eight fill an exact 4x2 on lg, 2x4 on sm and stack
// single-column on mobile.
const TOOL_COLUMNS = { base: 1, sm: 2, lg: 4 } as const;

const tileDividers = (index: number, total: number) => {
  const hasRight = (cols: number) => index % cols !== cols - 1;
  const hasBelow = (cols: number) =>
    Math.floor(index / cols) < Math.floor((total - 1) / cols);
  const classes: string[] = [];
  if (hasRight(TOOL_COLUMNS.sm)) classes.push('sm:border-r');
  if (hasRight(TOOL_COLUMNS.lg)) classes.push('lg:border-r');
  if (hasBelow(TOOL_COLUMNS.base)) {
    if (hasBelow(TOOL_COLUMNS.sm)) {
      classes.push(hasBelow(TOOL_COLUMNS.lg) ? 'border-b' : 'border-b lg:border-b-0');
    } else {
      // hasBelow(lg) implies hasBelow(sm), so sm:border-b-0 covers lg too.
      classes.push('border-b sm:border-b-0');
    }
  }
  return classes.join(' ');
};

export const LandingPage = () => {
  const [currentCmdIndex, setCurrentCmdIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCmdIndex((prev) => (prev + 1) % SAMPLE_COMMANDS.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const totalLinuxCount = COMMANDS.filter((c) => c.section === 'linux').length;
  const totalCTFCount = COMMANDS.filter((c) => c.section === 'ctf').length;
  const totalCategories = LINUX_CATEGORIES.length + CTF_DOMAINS.length;

  const stats = [
    { value: totalLinuxCount, label: 'Linux commands', accent: 'text-[var(--terminal-green)]' },
    { value: totalCTFCount, label: 'CTF & security tools', accent: 'text-[var(--ctf-red)]' },
    { value: totalCategories, label: 'Reference categories', accent: 'text-[var(--text-heading)]' },
  ];

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--border)]">
        <div className="ambient absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--terminal-green)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--terminal-green)]" />
              Linux &amp; CTF reference
            </span>

            <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-tight text-[var(--text-heading)] sm:text-6xl lg:text-7xl">
              Every flag,
              <br />
              every example,
              <br />
              <span className="italic text-[var(--terminal-green)]">without the guesswork.</span>
            </h1>

            <p className="max-w-[58ch] text-base leading-relaxed text-[var(--text-muted)] sm:text-lg">
              A hand-checked reference for {totalLinuxCount} Linux utilities and {totalCTFCount} CTF and security
              tools. Real syntax, the flags that matter, and output you can trust enough to copy.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to="/linux/file-and-directory/ls"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--terminal-green)] px-5 py-3 font-mono text-sm font-semibold text-[var(--bg)] hover:bg-[var(--terminal-green-dim)]"
              >
                <Terminal className="h-4 w-4" />
                Browse Linux commands
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/ctf"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--ctf-red)]/45 px-5 py-3 font-mono text-sm font-semibold text-[var(--ctf-red)] hover:bg-[var(--ctf-red-bg)]"
              >
                <Shield className="h-4 w-4" />
                CTF &amp; security tools
              </Link>
            </div>

            {/* Contact — flip tiles reveal social profiles */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Contact
              </span>
              <SocialFlipButton />
            </div>

            {/* Stat strip — a divided rule, not three floating cards */}
            <dl className="flex flex-wrap items-stretch gap-y-4 border-t border-[var(--border)] pt-6">
              {stats.map((stat, index) => (
                <div
                  key={stat.label}
                  className={`pr-6 ${index > 0 ? 'border-l border-[var(--border)] pl-6' : ''}`}
                >
                  <dt className="sr-only">{stat.label}</dt>
                  <dd>
                    <span className={`block font-display text-3xl font-semibold tabular ${stat.accent}`}>
                      {stat.value}
                    </span>
                    <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {stat.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Live terminal demo */}
          <div className="relative">
            <div className="terminal-window overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-surface-elevated)] px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--ctf-red)]/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--amber-warning)]/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--terminal-green)]/70" />
                </div>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">linuxdocs@reference:~</span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--terminal-green)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--terminal-green)] blinking" />
                  live
                </span>
              </div>
              <div className="min-h-[15rem] space-y-3 bg-[var(--code-bg)] p-5 font-mono text-sm">
                <div className="flex items-center gap-2 text-[var(--terminal-green)]">
                  <span>$</span>
                  <span className="font-semibold text-[var(--text-heading)]">
                    {SAMPLE_COMMANDS[currentCmdIndex].cmd}
                  </span>
                </div>
                <pre className="whitespace-pre-wrap border-l-2 border-[var(--border)] pl-4 text-xs leading-relaxed text-[var(--text-muted)]">
                  {SAMPLE_COMMANDS[currentCmdIndex].output}
                </pre>
              </div>
            </div>
            <p className="mt-3 text-right font-mono text-[11px] text-[var(--text-muted)]">
              One of {COMMANDS.length} documented entries
            </p>
          </div>
        </div>
      </section>

      {/* Tools band */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-2xl border border-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool, index) => (
            <Link
              key={tool.to}
              to={tool.to}
              className={`group flex flex-col gap-3 border-[var(--border)] bg-[var(--bg-surface)] p-6 hover:bg-[var(--bg-surface-elevated)] ${tileDividers(index, TOOLS.length)}`}
            >
              <tool.icon className="h-5 w-5 text-[var(--terminal-green)]" />
              <span className="font-display text-lg font-semibold text-[var(--text-heading)]">{tool.label}</span>
              <span className="text-xs leading-relaxed text-[var(--text-muted)]">{tool.blurb}</span>
              <span className="mt-auto inline-flex items-center gap-1 pt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)] group-hover:text-[var(--terminal-green)]">
                Open
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Linux categories */}
      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div className="space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--terminal-green)]">
              Section 01
            </span>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-4xl">
              Linux reference
            </h2>
            <p className="max-w-[52ch] text-sm leading-relaxed text-[var(--text-muted)]">
              System administration and file handling, grouped the way you actually reach for them.
            </p>
          </div>
          <Link
            to="/linux/file-and-directory/ls"
            className="inline-flex items-center gap-1 font-mono text-xs text-[var(--terminal-green)] hover:underline"
          >
            Start with ls
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINUX_CATEGORIES.map((cat, index) => {
            const count = COMMANDS.filter((c) => c.section === 'linux' && c.category === cat.id).length;
            return (
              <Link
                key={cat.id}
                to={`/linux/${cat.id}`}
                className="group relative flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 hover:-translate-y-0.5 hover:border-[var(--terminal-green)]/45"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Terminal className="h-4 w-4 text-[var(--text-muted)] transition-colors group-hover:text-[var(--terminal-green)]" />
                </div>
                <h3 className="font-display text-xl font-semibold text-[var(--text-heading)] group-hover:text-[var(--terminal-green)]">
                  {cat.name}
                </h3>
                <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">{cat.description}</p>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {count} {count === 1 ? 'command' : 'commands'}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[var(--terminal-green)] transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTF domains */}
      <section className="mx-auto max-w-7xl space-y-8 px-4 py-16 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
          <div className="space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ctf-red)]">
              Section 02
            </span>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-4xl">
              CTF &amp; security
            </h2>
            <p className="max-w-[52ch] text-sm leading-relaxed text-[var(--text-muted)]">
              Recon, exploitation, forensics and reversing tools — documented for learning, not for unauthorised
              access.
            </p>
          </div>
          <Link
            to="/ctf"
            className="inline-flex items-center gap-1 font-mono text-xs text-[var(--ctf-red)] hover:underline"
          >
            Open CTF home
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CTF_DOMAINS.map((domain, index) => {
            const count = COMMANDS.filter((c) => c.section === 'ctf' && c.category === domain.id).length;
            return (
              <Link
                key={domain.id}
                to={`/ctf/${domain.id}`}
                className="group relative flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 hover:-translate-y-0.5 hover:border-[var(--ctf-red)]/45"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Shield className="h-4 w-4 text-[var(--text-muted)] transition-colors group-hover:text-[var(--ctf-red)]" />
                </div>
                <h3 className="font-display text-xl font-semibold text-[var(--text-heading)] group-hover:text-[var(--ctf-red)]">
                  {domain.name}
                </h3>
                <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">{domain.description}</p>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] pt-3">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {count} {count === 1 ? 'tool' : 'tools'}
                  </span>
                  <ArrowRight className="h-4 w-4 text-[var(--ctf-red)] transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Ethics note */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--amber-warning)]" />
            <p className="max-w-[64ch] text-sm leading-relaxed text-[var(--text-muted)]">
              Security tooling here is documented for study and for systems you own or are authorised to test.
              LinuxDocs never runs anything against a live host.
            </p>
          </div>
          <Link
            to="/terms"
            className="shrink-0 rounded-lg border border-[var(--border)] px-4 py-2.5 font-mono text-xs text-[var(--text)] hover:border-[var(--text-muted)]/40"
          >
            Read the terms
          </Link>
        </div>
      </section>
    </div>
  );
};
