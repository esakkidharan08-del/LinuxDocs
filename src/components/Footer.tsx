import { Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import SocialFlipButton from './ui/SocialFlipButton';

export const Footer = () => {
  return (
    <footer className="border-t border-[var(--border)] px-6 py-10 text-sm text-[var(--text-muted)]">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-md bg-[var(--terminal-green-bg)] p-1 text-[var(--terminal-green)]">
                <Terminal className="h-4 w-4" />
              </div>
              <span className="font-display text-base font-semibold text-[var(--text-heading)]">LinuxDocs</span>
            </div>
            <p className="max-w-xs text-xs leading-relaxed">
              A reference for Linux utilities and CTF tooling. Copy syntax, read real output, practise in the browser.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-10 gap-y-6">
            <nav aria-label="Reference" className="space-y-2 text-xs">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]/70">Reference</p>
              <Link to="/" className="block hover:text-[var(--terminal-green)]">Linux commands</Link>
              <Link to="/ctf" className="block hover:text-[var(--ctf-red)]">CTF &amp; security</Link>
              <Link to="/cheat-sheets" className="block hover:text-[var(--terminal-green)]">Cheat sheets</Link>
            </nav>

            <nav aria-label="Tools" className="space-y-2 text-xs">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]/70">Tools</p>
              <Link to="/explain" className="block hover:text-[var(--terminal-green)]">Explain a command</Link>
              <Link to="/practice-terminal" className="block hover:text-[var(--terminal-green)]">Practice terminal</Link>
              <Link to="/learn" className="block hover:text-[var(--terminal-green)]">Learning paths</Link>
              <Link to="/flashcards" className="block hover:text-[var(--terminal-green)]">Flashcards</Link>
              <Link to="/speed-drill" className="block hover:text-[var(--terminal-green)]">Speed drill</Link>
              <Link to="/command-of-the-day" className="block hover:text-[var(--terminal-green)]">Command of the day</Link>
              <Link to="/compare" className="block hover:text-[var(--terminal-green)]">Compare</Link>
            </nav>

            <nav aria-label="Legal and contact" className="space-y-2 text-xs">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]/70">More</p>
              <Link to="/intro" className="block hover:text-[var(--terminal-green)]">Replay intro</Link>
              <Link to="/privacy" className="block hover:text-[var(--text)]">Privacy</Link>
              <Link to="/terms" className="block hover:text-[var(--text)]">Terms</Link>
              <a
                href="mailto:maintainers@linuxdocs.local?subject=LinuxDocs%20feedback"
                className="block hover:text-[var(--text)]"
              >
                Report an issue
              </a>
            </nav>
          </div>
        </div>

        {/* Contact bar — flip tiles reveal social profiles */}
        <div className="mt-10 flex flex-col items-center justify-between gap-6 border-t border-[var(--border)] pt-6 sm:flex-row">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Contact
          </span>
          <SocialFlipButton />
          <p className="font-mono text-[11px] text-[var(--text-muted)]/80">
            © {new Date().getFullYear()} LinuxDocs — educational use only.
          </p>
        </div>
      </div>
    </footer>
  );
};
