import { Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-surface)] py-8 px-6 text-sm text-[var(--text-muted)]">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1 rounded bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]">
            <Terminal className="w-4 h-4" />
          </div>
          <span className="font-mono font-bold text-[var(--text-heading)]">LinuxDocs</span>
          <span className="text-xs">© {new Date().getFullYear()} — MDN-style reference for Linux & CTF security tools.</span>
        </div>

        <div className="flex items-center gap-6 font-mono text-xs">
          <Link to="/" className="hover:text-[var(--terminal-green)] transition-colors">Linux Reference</Link>
          <Link to="/ctf" className="hover:text-[var(--ctf-red)] transition-colors">CTF & Security</Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--text)] transition-colors"
          >
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </footer>
  );
};
