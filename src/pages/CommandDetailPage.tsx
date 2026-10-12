import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCommand, getPathForCommand, getCategory, getCTFDomain } from '../data/commands';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { TableOfContents } from '../components/TableOfContents';
import { CodeBlock } from '../components/CodeBlock';
import { Terminal, Shield, AlertTriangle, Tag, Bookmark, BookmarkCheck, Save, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const CommandDetailPage = () => {
  const { slug } = useParams<{ category?: string; domain?: string; slug?: string }>();
  const command = getCommand(slug || '');
  const { user, bookmarks, notes, toggleBookmark, saveNote, deleteNote, addHistory } = useAuth();

  const [localNote, setLocalNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
const saveTimeoutRef = useRef<number | null>(null);

  const isBookmarked = slug ? bookmarks.has(slug) : false;
  const savedNote = slug ? notes.get(slug) || '' : '';
  const isCTF = command?.section === 'ctf';
  const parentName = isCTF
    ? getCTFDomain(command?.category || '')?.name || command?.category || ''
    : getCategory(command?.category || '')?.name || command?.category || '';

  const tocItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'syntax', label: 'Syntax' },
    ...(command?.options.length ? [{ id: 'options', label: 'Options & Flags' }] : []),
    { id: 'examples', label: 'Examples' },
    { id: 'use-cases', label: 'Use Cases' },
    ...(command?.related.length ? [{ id: 'related', label: 'Related Commands' }] : [])
  ];

  // Track recently viewed when user is logged in
  useEffect(() => {
    if (user && slug && command) {
      addHistory(slug);
    }
  }, [user, slug, command, addHistory]);

  // Load saved note into local state
  useEffect(() => {
    setLocalNote(savedNote);
  }, [savedNote]);

  // Auto-save note with debounce
  const handleNoteChange = (value: string) => {
    setLocalNote(value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (user && slug) {
      setNoteSaving(true);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveNote(slug, value);
        } finally {
          setNoteSaving(false);
        }
      }, 1000);
    }
  };

  const handleToggleBookmark = async () => {
    if (!user || !slug) return;
    await toggleBookmark(slug);
  };

  const handleSaveNote = async () => {
    if (!user || !slug) return;
    setNoteSaving(true);
    try {
      if (localNote.trim()) {
        await saveNote(slug, localNote);
      } else {
        await deleteNote(slug);
        setLocalNote('');
      }
    } finally {
      setNoteSaving(false);
    }
  };

  if (!command) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono space-y-6">
        <div className="p-4 rounded-xl border border-[var(--ctf-red)]/40 bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] inline-block">
          <Terminal className="w-12 h-12 mx-auto" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-heading)]">
          bash: {slug || 'command'}: command not found
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
          The command page you requested does not exist in LinuxDocs. Try searching using Ctrl+K or check suggested commands below.
        </p>
        <div className="pt-4 flex justify-center gap-4">
          <Link to="/" className="px-5 py-2.5 rounded-lg bg-[var(--terminal-green)] text-slate-950 font-bold text-xs">
            Return Home
          </Link>
          <Link to="/ctf" className="px-5 py-2.5 rounded-lg border border-[var(--ctf-red)]/50 bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] font-bold text-xs">
            CTF Tools
          </Link>
        </div>
      </div>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSaveNote();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 text-left" onKeyDown={handleKeyDown}>
      <Breadcrumbs
        items={[
          { label: isCTF ? 'CTF & Security' : 'Linux Reference', to: isCTF ? '/ctf' : '/' },
          { label: parentName, to: isCTF ? `/ctf/${command.category}` : `/linux/${command.category}` },
          { label: command.name }
        ]}
      />

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1 space-y-10 min-w-0">
          {/* Header */}
          <div className="space-y-4 border-b border-[var(--border)] pb-8">
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider ${
                  isCTF
                    ? 'bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] border border-[var(--ctf-red)]/30'
                    : 'bg-[var(--terminal-green-bg)] text-[var(--terminal-green)] border border-[var(--terminal-green)]/30'
                }`}
              >
                {isCTF ? <Shield className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                {isCTF ? 'CTF Tool' : 'Linux Utility'}
              </span>
              <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] px-2.5 py-1 rounded border border-[var(--border)]">
                Category: {parentName}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <h1 className="text-4xl sm:text-5xl font-extrabold font-mono text-[var(--text-heading)] tracking-tight flex-1 min-w-0">
                {command.name}
              </h1>
              {user && slug && (
                <button
                  onClick={handleToggleBookmark}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors shrink-0 ${
                    isBookmarked
                      ? 'bg-[var(--terminal-green)] text-[var(--bg)] border-[var(--terminal-green)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--terminal-green)] hover:text-[var(--terminal-green)]'
                  }`}
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                  title={isBookmarked ? 'Remove bookmark (Ctrl+B)' : 'Add bookmark (Ctrl+B)'}
                >
                  {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                  <span className="hidden sm:inline font-mono text-xs">{isBookmarked ? 'Bookmarked' : 'Bookmark'}</span>
                </button>
              )}
            </div>

            <p className="text-lg text-[var(--text-muted)] leading-relaxed">{command.summary}</p>

            {command.warnings && (
              <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 flex items-start gap-3 text-xs leading-relaxed font-sans">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-mono block mb-1 uppercase tracking-wider text-[11px]">Warning / Ethics Notice</strong>
                  <span>{command.warnings}</span>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section for logged-in users */}
          {user && (
            <section id="notes" className="space-y-4 p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-mono text-[var(--text-heading)] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[var(--terminal-green)]" />
                  Your Notes
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono ${noteSaving ? 'text-amber-500' : 'text-[var(--text-muted)]'}`}>
                    {noteSaving ? 'Saving...' : 'Auto-saves after 1s'}
                  </span>
                  <button
                    onClick={handleSaveNote}
                    disabled={noteSaving || !localNote.trim()}
                    className="px-3 py-1.5 rounded-lg bg-[var(--terminal-green)] text-[var(--bg)] text-xs font-mono hover:bg-[var(--terminal-green-dim)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Save</span>
                  </button>
                </div>
              </div>
              <textarea
                ref={noteTextareaRef}
                value={localNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="Add your personal notes for this command... (Ctrl+S to save)"
                className="w-full min-h-[120px] px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--terminal-green)] focus:ring-1 focus:ring-[var(--terminal-green)] font-mono text-sm resize-y transition-colors"
                rows={6}
                spellCheck={false}
              />
              {localNote.trim() && (
                <p className="text-xs text-[var(--text-muted)] font-mono">
                  Press <kbd className="px-1.5 py-0.5 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded">Ctrl+S</kbd> to save
                </p>
              )}
            </section>
          )}

          {/* Overview Section */}
          <section id="overview" className="space-y-3">
            <h2 className="text-xl font-bold font-mono text-[var(--text-heading)]">Description</h2>
            <p className="text-sm text-[var(--text)] leading-relaxed">{command.description}</p>
          </section>

          {/* Syntax Section */}
          <section id="syntax" className="space-y-3">
            <h2 className="text-xl font-bold font-mono text-[var(--text-heading)]">Syntax</h2>
            <CodeBlock code={command.syntax} language="bash" />
          </section>

          {/* Options & Flags */}
          {command.options.length > 0 && (
            <section id="options" className="space-y-4">
              <h2 className="text-xl font-bold font-mono text-[var(--text-heading)]">Common Options & Flags</h2>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-x-auto shadow-sm">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-b border-[var(--border)] uppercase">
                    <tr>
                      <th className="p-3 font-semibold">Flag / Option</th>
                      <th className="p-3 font-semibold">Description</th>
                      <th className="p-3 font-semibold">Example Usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text)]">
                    {command.options.map((opt, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-surface-hover)]">
                        <td className="p-3 font-bold text-[var(--terminal-green)] whitespace-nowrap">{opt.flag}</td>
                        <td className="p-3 font-sans leading-relaxed text-[var(--text)]">{opt.description}</td>
                        <td className="p-3 text-[var(--text-muted)] whitespace-nowrap">
                          {opt.example ? <code>{opt.example}</code> : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Examples Section */}
          <section id="examples" className="space-y-6">
            <h2 className="text-xl font-bold font-mono text-[var(--text-heading)]">Practical Examples</h2>
            <div className="space-y-6">
              {command.examples.map((ex, i) => (
                <div key={i} className="p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] space-y-3">
                  <h3 className="text-sm font-bold font-mono text-[var(--text-heading)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[var(--terminal-green-bg)] text-[var(--terminal-green)] text-xs flex items-center justify-center font-mono">
                      {i + 1}
                    </span>
                    {ex.title}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] font-sans">{ex.explanation}</p>
                  <CodeBlock code={ex.command} />
                  {ex.output && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">Sample Output:</span>
                      <pre className="p-3 rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] text-xs font-mono text-[var(--text-muted)] overflow-x-auto">
                        {ex.output}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Use Cases Section */}
          <section id="use-cases" className="space-y-3">
            <h2 className="text-xl font-bold font-mono text-[var(--text-heading)]">Primary Use Cases</h2>
            <ul className="space-y-2">
              {command.useCases.map((uc, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-[var(--text)] font-sans">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--terminal-green)] mt-1.5 shrink-0" />
                  <span>{uc}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Related Commands */}
          {command.related.length > 0 && (
            <section id="related" className="space-y-4 pt-4 border-t border-[var(--border)]">
              <h2 className="text-xl font-bold font-mono text-[var(--text-heading)]">Related Utilities</h2>
              <div className="flex flex-wrap gap-2">
                {command.related.map((relSlug) => {
                  const relCmd = getCommand(relSlug);
                  if (!relCmd) return null;
                  return (
                    <Link
                      key={relSlug}
                      to={getPathForCommand(relCmd)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--terminal-green)] text-xs font-mono text-[var(--text)] hover:text-[var(--terminal-green)] transition-all flex items-center gap-1.5"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>{relCmd.name}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tags */}
          <div className="flex items-center gap-2 pt-4 text-xs font-mono text-[var(--text-muted)]">
            <Tag className="w-3.5 h-3.5" />
            <span>Tags:</span>
            <div className="flex flex-wrap gap-1.5">
              {command.tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border)]">
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Table of contents sidebar */}
        <TableOfContents items={tocItems} />
      </div>
    </div>
  );
};