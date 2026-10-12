import { useState, useEffect, useRef } from 'react';
import { Search, Terminal, Shield, CornerDownLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { COMMANDS, getPathForCommand } from '../data/commands';
import type { Command } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useRef(
    new Fuse(COMMANDS, {
      keys: ['name', 'summary', 'tags', 'syntax'],
      threshold: 0.35,
      distance: 100
    })
  ).current;

  const results: Command[] = query.trim()
    ? fuse.search(query).map((res) => res.item)
    : COMMANDS.slice(0, 10);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // handled in parent or Header
        }
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          navigate(getPathForCommand(results[selectedIndex]));
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-sm">
      <div
        className="w-full max-w-2xl rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
        aria-label="Search Commands"
      >
        <div className="flex items-center px-4 border-b border-[var(--border)]">
          <Search className="w-5 h-5 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-search-results"
            placeholder="Search commands, syntax, tags (e.g. nmap, files, grep)..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="w-full h-14 bg-transparent px-3 text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none font-mono text-sm"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="Close search"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          id="command-search-results"
          role="listbox"
          className="max-h-96 overflow-y-auto p-2 divide-y divide-[var(--border-subtle)]"
        >
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)] font-mono">
              <p>bash: {query}: command not found in database</p>
              <p className="mt-1 text-xs opacity-70">Try searching for generic terms like "network", "files", or "reversing"</p>
            </div>
          ) : (
            results.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const isCTF = cmd.section === 'ctf';
              return (
                <div
                  key={cmd.slug}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    navigate(getPathForCommand(cmd));
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? isCTF
                        ? 'bg-[var(--ctf-red-bg)] text-[var(--text-heading)]'
                        : 'bg-[var(--terminal-green-bg)] text-[var(--text-heading)]'
                      : 'hover:bg-[var(--bg-surface-elevated)] text-[var(--text)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-1.5 mt-0.5 rounded ${
                        isCTF
                          ? 'text-[var(--ctf-red)] bg-[var(--ctf-red-bg)]'
                          : 'text-[var(--terminal-green)] bg-[var(--terminal-green-bg)]'
                      }`}
                    >
                      {isCTF ? <Shield className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">{cmd.name}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)]">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5">{cmd.summary}</p>
                    </div>
                  </div>
                  {isSelected && (
                    <CornerDownLeft className="w-4 h-4 text-[var(--text-muted)] shrink-0 ml-2" />
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-surface-elevated)] border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] font-mono">
          <div className="flex items-center gap-3">
            <span>Use ↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>ESC to close</span>
          </div>
          <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
};
