import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Terminal, Shield, CornerDownLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { getPathForLight, useCatalog } from '../context/CatalogContext';
import type { CommandLight } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette = ({ isOpen, onClose }: CommandPaletteProps) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // The palette searches the authed light index (Part 1) — built in-memory
  // from the catalog, never from a bundled dataset.
  const { lights, loading: catalogLoading, error: catalogError } = useCatalog();

  /* #tag chips: leading "#word" tokens in the query filter by tag without
     polluting the fuzzy text match. "#", alone or at the word start. */
  const tagToken = useMemo(() => {
    const match = /(?:^|\s)#([a-z0-9-]+)/i.exec(query.trim());
    return match ? match[1].toLowerCase() : null;
  }, [query]);
  const textQuery = useMemo(
    () => (tagToken ? query.replace(/#\S+/, '').replace(/\s+/g, ' ').trim() : query.trim()),
    [query, tagToken],
  );

  useEffect(() => {
    setActiveTag(tagToken);
  }, [tagToken]);

  /* top tag chips typed by any light, sorted by usage depth (max 10) */
  const tagChips = useMemo(() => {
    const freq = new Map<string, number>();
    for (const light of lights) for (const tag of light.tags) freq.set(tag, (freq.get(tag) ?? 0) + 1);
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([tag]) => tag);
  }, [lights]);

  /* searching only the tag-matched subset keeps results consistent */
  const searchScope = useMemo(
    () => (activeTag ? lights.filter((light) => light.tags.includes(activeTag)) : lights),
    [lights, activeTag],
  );

  const fuse = useMemo(
    () =>
      new Fuse(searchScope, {
        keys: ['name', 'summary', 'tags', 'slug'],
        threshold: 0.35,
        distance: 100,
      }),
    [searchScope],
  );

  const results: CommandLight[] = useMemo(() => {
    if (activeTag && !textQuery) {
      /* tag-only mode: list that tag's commands, freshest names first */
      return lights.filter((light) => light.tags.includes(activeTag)).slice(0, 50);
    }
    if (searchScope.length === 0) return [];
    return textQuery ? fuse.search(textQuery).map((res) => res.item) : searchScope.slice(0, 10);
  }, [activeTag, textQuery, searchScope, lights, fuse]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setActiveTag(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, activeTag]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
          navigate(getPathForLight(results[selectedIndex]));
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay)] px-4 pt-16 backdrop-blur-sm sm:pt-24"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="animate-in w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Search commands"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4">
          <Search className="h-5 w-5 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-search-results"
            placeholder="Search commands, syntax, or tags…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="h-14 w-full bg-transparent px-2 font-mono text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {tagChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-subtle)] px-4 py-2">
            <span className="py-1 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">#tags</span>
            {tagChips.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  const turningOn = activeTag !== tag;
                  setActiveTag(turningOn ? tag : null);
                  setQuery(turningOn ? `#${tag} ` : '');
                  setSelectedIndex(0);
                }}
                className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  activeTag === tag
                    ? 'border-[var(--terminal-green)] bg-[var(--terminal-green)]/10 text-[var(--terminal-green)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--terminal-green)]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div
          id="command-search-results"
          role="listbox"
          className="max-h-96 divide-y divide-[var(--border-subtle)] overflow-y-auto p-2"
        >
          {catalogLoading ? (
            <div className="py-12 text-center font-mono text-sm text-[var(--text-muted)]">
              <p>loading command index<span className="blinking">_</span></p>
            </div>
          ) : catalogError ? (
            <div className="py-12 text-center font-mono text-sm text-[var(--ctf-red)]">
              <p>{catalogError}</p>
              <p className="mt-1 text-xs opacity-70">Close and reopen the palette to retry.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center font-mono text-sm text-[var(--text-muted)]">
              <p>bash: {query}: command not found in database</p>
              <p className="mt-1 text-xs opacity-70">
                Try a broader term like &ldquo;network&rdquo;, &ldquo;files&rdquo; or &ldquo;reversing&rdquo;
              </p>
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
                    navigate(getPathForLight(cmd));
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg p-3 ${
                    isSelected
                      ? isCTF
                        ? 'bg-[var(--ctf-red-bg)] text-[var(--text-heading)]'
                        : 'bg-[var(--terminal-green-bg)] text-[var(--text-heading)]'
                      : 'text-[var(--text)] hover:bg-[var(--bg-surface-elevated)]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded p-1.5 ${
                        isCTF
                          ? 'bg-[var(--ctf-red-bg)] text-[var(--ctf-red)]'
                          : 'bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]'
                      }`}
                    >
                      {isCTF ? <Shield className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{cmd.name}</span>
                        <span className="rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">{cmd.summary}</p>
                    </div>
                  </div>
                  {isSelected && <CornerDownLeft className="ml-2 h-4 w-4 shrink-0 text-[var(--text-muted)]" />}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--bg-surface-elevated)] px-4 py-2 font-mono text-[11px] text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
            <span>#tag restricts</span>
          </div>
          <span>
            {results.length} {results.length === 1 ? 'result' : 'results'}
          </span>
        </div>
      </div>
    </div>
  );
};
