import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Search, Menu, Shield, User, LogOut, Settings, Bookmark, ChevronDown } from 'lucide-react';
import { Link, useLocation, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeSwitch } from './unlumen-ui/theme-switch';

interface HeaderProps {
  onOpenSearch: () => void;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onToggleSidebar }) => {
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

  const navAccent = isCTF ? 'text-[var(--ctf-red)]' : 'text-[var(--terminal-green)]';

  if (loading) {
    return (
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 animate-pulse rounded-md border border-[var(--border)] bg-[var(--bg-surface)]" />
            <div className="h-5 w-28 animate-pulse rounded bg-[var(--bg-surface)]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-9 w-64 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] sm:block" />
            <div className="h-9 w-9 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--bg-surface)]" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text)]"
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="group flex items-center gap-2.5" aria-label="LinuxDocs home">
            <div
              className={`rounded-md border p-1.5 ${
                isCTF
                  ? 'border-[var(--ctf-red)]/40 bg-[var(--ctf-red-bg)] text-[var(--ctf-red)]'
                  : 'border-[var(--terminal-green)]/40 bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]'
              }`}
            >
              {isCTF ? <Shield className="h-5 w-5" /> : <Terminal className="h-5 w-5" />}
            </div>
            <span className="font-display text-xl font-semibold tracking-tight text-[var(--text-heading)]">
              Linux<span className={`transition-colors ${navAccent}`}>Docs</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="ml-6 hidden items-center gap-1 md:flex">
            <NavLink
              to="/"
              className={({ isActive }) => `nav-link rounded-md px-3 py-2 text-sm ${isActive ? '' : 'hover:bg-[var(--bg-surface-elevated)]'}`}
            >
              Linux Reference
            </NavLink>
            <NavLink
              to="/ctf"
              className={({ isActive }) => `nav-link nav-link--ctf rounded-md px-3 py-2 text-sm ${isActive ? '' : 'hover:bg-[var(--bg-surface-elevated)]'}`}
            >
              CTF &amp; Security
            </NavLink>
            <NavLink
              to="/cheat-sheets"
              className={({ isActive }) => `nav-link rounded-md px-3 py-2 text-sm ${isActive ? '' : 'hover:bg-[var(--bg-surface-elevated)]'}`}
            >
              Cheat Sheets
            </NavLink>
            <NavLink
              to="/learn"
              className={({ isActive }) => `nav-link rounded-md px-3 py-2 text-sm ${isActive ? '' : 'hover:bg-[var(--bg-surface-elevated)]'}`}
            >
              Learn
            </NavLink>
            <NavLink
              to="/flashcards"
              className={({ isActive }) => `nav-link rounded-md px-3 py-2 text-sm ${isActive ? '' : 'hover:bg-[var(--bg-surface-elevated)]'}`}
            >
              Flashcards
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-muted)] hover:border-[var(--text-muted)]/40 hover:text-[var(--text)] sm:w-64"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search commands…</span>
              <span className="sm:hidden">Search</span>
            </span>
            <kbd className="hidden rounded border border-[var(--border)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)] sm:inline-block">
              Ctrl K
            </kbd>
          </button>

          <ThemeSwitch />

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[var(--text)] hover:border-[var(--text-muted)]/40"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <User className="h-4 w-4" />
                <span className="hidden font-mono text-sm sm:inline">{user.username}</span>
                <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
              </button>

              {userMenuOpen && (
                <div className="terminal-window absolute right-0 z-50 mt-2 w-52 overflow-hidden">
                  <div className="border-b border-[var(--border)] p-3">
                    <p className="font-mono text-sm text-[var(--text-heading)]">{user.username}</p>
                    <p className="truncate font-mono text-xs text-[var(--text-muted)]">{user.email}</p>
                  </div>
                  <NavLink
                    to="/dashboard"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-[var(--text)] hover:bg-[var(--bg-surface-elevated)]"
                  >
                    <Bookmark className="h-4 w-4" />
                    <span className="font-mono text-sm">Dashboard</span>
                  </NavLink>
                  <NavLink
                    to="/settings"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-[var(--text)] hover:bg-[var(--bg-surface-elevated)]"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="font-mono text-sm">Settings</span>
                  </NavLink>
                  <div className="border-t border-[var(--border)]">
                    <button
                      onClick={async () => {
                        await logout();
                        setUserMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-[var(--ctf-red)] hover:bg-[var(--ctf-red-bg)]"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="font-mono text-sm">Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-1 sm:flex">
              <NavLink
                to="/sign-in"
                className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text)]"
              >
                Sign In
              </NavLink>
              <NavLink
                to="/sign-up"
                className="rounded-lg bg-[var(--terminal-green)] px-3.5 py-2 text-sm font-semibold text-[var(--bg)] hover:bg-[var(--terminal-green-dim)]"
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
