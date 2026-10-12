import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Home, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-24 text-center font-mono space-y-6">
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--code-bg)] text-[var(--terminal-green)] inline-block shadow-lg">
        <Terminal className="w-12 h-12 mx-auto" />
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-[var(--text-heading)]">
          404 — Page Not Found
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
          bash: cd: path does not exist on filesystem.
        </p>
      </div>

      <div className="pt-4 flex justify-center gap-4 text-xs font-mono">
        <Link
          to="/"
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[var(--terminal-green)] text-slate-950 font-bold shadow hover:bg-[var(--terminal-green-dim)] transition-colors"
        >
          <Home className="w-4 h-4" />
          <span>cd /home</span>
        </Link>
        <Link
          to="/ctf"
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] font-bold hover:bg-[var(--bg-surface-elevated)] transition-colors"
        >
          <Search className="w-4 h-4 text-[var(--ctf-red)]" />
          <span>CTF Reference</span>
        </Link>
      </div>
    </div>
  );
};
