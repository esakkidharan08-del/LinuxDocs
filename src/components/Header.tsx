import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Sun, Moon, Search, Menu, Shield, User, LogOut, Settings, Bookmark, ChevronDown } from 'lucide-react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useTheme } from './ThemeContext';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const { user, logout, loading } = useAuth();
  const isCTF = location.pathname.startsWith('/ctf');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className={`p-1.5 rounded-md border ${isCTF ? 'border-[var(--ctf-red)]/40 bg-[var(--ctf-red-bg)] text-[var(--ctf-red)]' : 'border-[var(--terminal-green)]/40 bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]'}`}>
                {isCTF ? <Shield className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
              </div>
              <span className="font-mono font-bold text-lg tracking-tight text-[var(--text-heading)]">
                Linux<span className={isCTF ? 'text-[var(--ctf-red)]' : 'text-[var(--terminal-green)]'}>Docs</span>
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-64 h-10 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg animate-pulse" />
            <div className="w-10 h-10 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-elevated)] lg:hidden"
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className={`p-1.5 rounded-md border ${isCTF ? 'border-[var(--ctf-red)]/40 bg-[var(--ctf-red-bg)] text-[var(--ctf-red)]' : 'border-[var(--terminal-green)]/40 bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]'}`}>
              {isCTF ? <Shield className="w-5 h-5" /> : <Terminal className="w-5 h-5" />}
            </div>
            <span className="font-mono font-bold text-lg tracking-tight text-[var(--text-heading)] group-hover:text-[var(--terminal-green)] transition-colors">
              Linux<span className={isCTF ? 'text-[var(--ctf-red)]' : 'text-[var(--terminal-green)]'}>Docs</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-6 text-sm font-medium">
            <NavLink
              to="/"
              className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors ${isActive ? 'text-[var(--terminal-green)] bg-[var(--terminal-green-bg)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              Linux Reference
            </NavLink>
            <NavLink
              to="/ctf"
              className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors ${isActive ? 'text-[var(--ctf-red)] bg-[var(--ctf-red-bg)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
            >
              CTF & Security
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text)] text-sm shadow-sm transition-all sm:w-64 justify-between"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search commands...</span>
              <span className="sm:hidden">Search...</span>
            </div>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[11px] font-mono bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded text-[var(--text-muted)]">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline font-mono text-sm">{user.username}</span>
                <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 terminal-window bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="p-3 border-b border-[var(--border)]">
                    <p className="font-mono text-sm text-[var(--text-heading)]">{user.username}</p>
                    <p className="font-mono text-xs text-[var(--text-muted)] truncate">{user.email}</p>
                  </div>
                  <NavLink
                    to="/dashboard"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-[var(--text)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                  >
                    <Bookmark className="w-4 h-4" />
                    <span className="font-mono text-sm">Dashboard</span>
                  </NavLink>
                  <NavLink
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-[var(--text)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="font-mono text-sm">Settings</span>
                  </NavLink>
                  <hr className="border-[var(--border)] mx-2" />
                  <button
                    onClick={async () => { await logout(); setUserMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-500/10 transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-mono text-sm">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <NavLink
                to="/sign-in"
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
              >
                Sign In
              </NavLink>
              <NavLink
                to="/sign-up"
                className="px-3 py-1.5 rounded-lg bg-[var(--terminal-green)] text-[var(--bg)] text-sm font-medium hover:bg-[var(--terminal-green-dim)] transition-colors"
              >
                Sign Up
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};