import { Link, useLocation } from 'react-router-dom';

const CONTENT = {
  privacy: {
    eyebrow: 'Privacy',
    title: 'What LinuxDocs stores',
    updated: 'Last updated 2 October 2026',
    intro:
      'LinuxDocs keeps almost everything in your browser. The only data that reaches a server is what you explicitly create by signing in.',
    sections: [
      {
        heading: 'In your browser',
        body: 'Your theme choice and practice-terminal transcript are saved to localStorage. They never leave your device and clearing site data removes them.',
      },
      {
        heading: 'On the server',
        body: 'If you register, we store your username, email, a bcrypt password hash, your bookmarks, notes and view history. Nothing else is collected.',
      },
      {
        heading: 'Cookies',
        body: 'A single HttpOnly refresh cookie keeps you signed in for 30 days. Access tokens live in memory only and are never written to localStorage. No analytics or advertising cookies are set.',
      },
      {
        heading: 'Deleting your data',
        body: 'Delete your account from Settings. It removes your user record and cascades to every bookmark, note and history entry in the same request.',
      },
    ],
  },
  terms: {
    eyebrow: 'Terms',
    title: 'Using LinuxDocs',
    updated: 'Last updated 2 October 2026',
    intro:
      'LinuxDocs is a study reference and a set of browser tools. Read what that does and does not cover before you rely on it.',
    sections: [
      {
        heading: 'Educational purpose',
        body: 'The command reference and CTF material exist to teach. Nothing here is authorisation to test a system you do not own or have written permission to assess.',
      },
      {
        heading: 'Accuracy',
        body: 'Syntax and examples are maintained by hand and may lag behind a newer release of a tool. Verify destructive commands against your own environment before running them.',
      },
      {
        heading: 'The practice terminal',
        body: 'The practice shell is a simulation. It parses a small command set in JavaScript and cannot read files, open a network connection or execute anything on your operating system.',
      },
      {
        heading: 'Your account',
        body: 'Keep your credentials to yourself. You are responsible for activity under your account and for exporting anything you want to keep before deleting it.',
      },
    ],
  },
} as const;

export const LegalPage = () => {
  const { pathname } = useLocation();
  const key = pathname.includes('terms') ? 'terms' : 'privacy';
  const page = CONTENT[key];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <nav aria-label="Breadcrumb" className="mb-8 font-mono text-xs text-[var(--text-muted)]">
        <Link to="/" className="hover:text-[var(--text)]">home</Link>
        <span className="px-2 text-[var(--text-muted)]/50">/</span>
        <span className="text-[var(--text-heading)]">{key}</span>
      </nav>

      <header className="space-y-4 border-b border-[var(--border)] pb-8">
        <span className="inline-flex rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {page.eyebrow}
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-5xl">
          {page.title}
        </h1>
        <p className="max-w-[62ch] text-base leading-relaxed text-[var(--text-muted)]">{page.intro}</p>
        <p className="font-mono text-[11px] text-[var(--text-muted)]/70">{page.updated}</p>
      </header>

      <div className="mt-10 space-y-8">
        {page.sections.map((section, index) => (
          <section key={section.heading} className="grid gap-2 sm:grid-cols-[3rem_1fr]">
            <span className="font-mono text-sm text-[var(--terminal-green)]">{String(index + 1).padStart(2, '0')}</span>
            <div className="space-y-2">
              <h2 className="font-display text-xl font-semibold text-[var(--text-heading)]">{section.heading}</h2>
              <p className="max-w-[64ch] text-sm leading-relaxed text-[var(--text)]">{section.body}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 border-t border-[var(--border)] pt-6 font-mono text-xs text-[var(--text-muted)]">
        <Link to={key === 'terms' ? '/privacy' : '/terms'} className="text-[var(--terminal-green)] hover:underline">
          {key === 'terms' ? 'Read the privacy notice' : 'Read the terms'}
        </Link>
      </div>
    </div>
  );
};
