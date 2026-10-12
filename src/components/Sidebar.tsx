import { NavLink } from 'react-router-dom';
import { LINUX_CATEGORIES, CTF_DOMAINS, COMMANDS } from '../data/commands';
import { Terminal, Shield, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-72 border-r border-[var(--border)] bg-[var(--bg)] transition-transform duration-200 ease-in-out lg:translate-x-0 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between lg:hidden mb-2">
            <span className="text-xs font-mono font-bold tracking-wider text-[var(--text-muted)] uppercase">Navigation</span>
            <button
              onClick={onClose}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text)]"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Linux Section */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--terminal-green)]">
              <Terminal className="w-3.5 h-3.5" />
              <span>Linux Commands</span>
            </div>
            <div className="space-y-1">
              {LINUX_CATEGORIES.map((cat) => {
                const count = COMMANDS.filter((c) => c.section === 'linux' && c.category === cat.id).length;
                return (
                  <NavLink
                    key={cat.id}
                    to={`/linux/${cat.id}`}
                    onClick={() => onClose()}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-elevated)]'
                      }`
                    }
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
                      {count}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* CTF Section */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-2 text-xs font-mono font-bold uppercase tracking-wider text-[var(--ctf-red)]">
              <Shield className="w-3.5 h-3.5" />
              <span>CTF & Security Domains</span>
            </div>
            <div className="space-y-1">
              {CTF_DOMAINS.map((domain) => {
                const count = COMMANDS.filter((c) => c.section === 'ctf' && c.category === domain.id).length;
                return (
                  <NavLink
                    key={domain.id}
                    to={`/ctf/${domain.id}`}
                    onClick={() => onClose()}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[var(--ctf-red-bg)] text-[var(--ctf-red)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-elevated)]'
                      }`
                    }
                  >
                    <span className="truncate">{domain.name}</span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">
                      {count}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
