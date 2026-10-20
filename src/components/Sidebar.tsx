import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LINUX_CATEGORIES, CTF_DOMAINS, COMMANDS } from '../data/commands';
import { Terminal, Shield, X, ChevronDown, BookOpen, Layers, Command, FileText, CalendarDays, Zap } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const STUDY_LINKS = [
  { to: '/learn', label: 'Learning paths', icon: BookOpen },
  { to: '/flashcards', label: 'Flashcards', icon: Layers },
  { to: '/practice-terminal', label: 'Practice terminal', icon: Terminal },
  { to: '/speed-drill', label: 'Speed drill', icon: Zap },
  { to: '/explain', label: 'Explain a command', icon: Command },
  { to: '/cheat-sheets', label: 'Cheat sheets', icon: FileText },
  { to: '/command-of-the-day', label: 'Command of the day', icon: CalendarDays },
];

/**
 * Navigation drawer. Hidden by default at every breakpoint; opened from the
 * header menu button and closed via the X button, the backdrop, or Escape.
 */
export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const [linuxOpen, setLinuxOpen] = useState(true);
  const [ctfOpen, setCtfOpen] = useState(true);

  // Close whenever navigation happens (any link click changes the path).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Escape closes the drawer while it is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lock page scroll behind the open drawer.
  useEffect(() => {
    if (isOpen) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-[var(--overlay)] backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        inert={!isOpen}
        aria-label="Documentation navigation"
        aria-hidden={!isOpen}
        className={`fixed bottom-0 left-0 top-16 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--bg)] transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Navigation
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text)]"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 p-4" aria-label="Section navigation">
          {/* Study & Tools */}
          <div>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Study &amp; Tools
            </p>
            <div className="space-y-0.5">
              {STUDY_LINKS.map((link) => (
                <NavLink key={link.to} to={link.to} onClick={onClose} className="side-link">
                  <link.icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                  <span className="truncate">{link.label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {/* Linux Section */}
          <div>
            <button
              type="button"
              onClick={() => setLinuxOpen((prev) => !prev)}
              aria-expanded={linuxOpen}
              className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--terminal-green)] hover:bg-[var(--bg-surface-elevated)]"
            >
              <span className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5" />
                <span>Linux Commands</span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${linuxOpen ? '' : '-rotate-90'}`} />
            </button>
            {linuxOpen && (
              <div className="space-y-0.5">
                {LINUX_CATEGORIES.map((cat) => {
                  const count = COMMANDS.filter((c) => c.section === 'linux' && c.category === cat.id).length;
                  return (
                    <NavLink
                      key={cat.id}
                      to={`/linux/${cat.id}`}
                      onClick={onClose}
                      className="side-link"
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                        {count}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>

          {/* CTF Section */}
          <div>
            <button
              type="button"
              onClick={() => setCtfOpen((prev) => !prev)}
              aria-expanded={ctfOpen}
              className="mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ctf-red)] hover:bg-[var(--bg-surface-elevated)]"
            >
              <span className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5" />
                <span>CTF &amp; Security</span>
              </span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${ctfOpen ? '' : '-rotate-90'}`} />
            </button>
            {ctfOpen && (
              <div className="space-y-0.5">
                {CTF_DOMAINS.map((domain) => {
                  const count = COMMANDS.filter((c) => c.section === 'ctf' && c.category === domain.id).length;
                  return (
                    <NavLink
                      key={domain.id}
                      to={`/ctf/${domain.id}`}
                      onClick={onClose}
                      className="side-link side-link--ctf"
                    >
                      <span className="truncate">{domain.name}</span>
                      <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                        {count}
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
};
