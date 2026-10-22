import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { TableOfContents } from '../components/TableOfContents';
import { CodeBlock } from '../components/CodeBlock';
import { Terminal, Shield, AlertTriangle, Tag, Bookmark, BookmarkCheck, Save, FileText, FileQuestion } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPathForLight, useCatalog, useCommandDoc } from '../context/CatalogContext';
import { commandBuilderSpecs } from '../data/commandBuilders';
import { CommandBuilder } from '../components/CommandBuilder';

export const CommandDetailPage = () => {
  const { slug } = useParams<{ category?: string; domain?: string; slug?: string }>();
  // Full docs load on demand from the authed API (Part 1): one GET per slug,
  // ETag-revalidated on repeat visits, held in memory only.
  const { command, loading: docLoading, error: docError, retry } = useCommandDoc(slug);
  const { lights, categoryMap, domainMap } = useCatalog();
  const { user, bookmarks, notes, toggleBookmark, saveNote, deleteNote, addHistory } = useAuth();

  const [localNote, setLocalNote] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  const isBookmarked = slug ? bookmarks.has(slug) : false;
  const savedNote = slug ? notes.get(slug) || '' : '';
  const isCTF = command?.section === 'ctf';
  // Mirrors the dataset pipeline's pending-review rule: entries with thin docs
  // (fewer than three examples, or missing options/useCases/tags) are flagged.
  const docsPendingReview =
    !!command &&
    (command.examples.length < 3 ||
      command.options.length === 0 ||
      command.useCases.length === 0 ||
      command.tags.length === 0);
  const parentName = isCTF
    ? domainMap.get(command?.category || '')?.name || command?.category || ''
    : categoryMap.get(command?.category || '')?.name || command?.category || '';

  const tocItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'syntax', label: 'Syntax' },
    ...(command?.options.length ? [{ id: 'options', label: 'Options & Flags' }] : []),
    { id: 'examples', label: 'Examples' },
    { id: 'use-cases', label: 'Use Cases' },
    ...(command?.related.length ? [{ id: 'related', label: 'Related Commands' }] : []),
  ];

  // Track recently viewed (server-synced; the local guest store no longer
  // exists — Part 1 removed guest mode).
  useEffect(() => {
    if (slug && command) {
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
    if (!slug) return;
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

  if (docLoading && !command) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="font-mono text-sm text-[var(--text-muted)]">
          fetch man page<span className="blinking">_</span>
        </p>
      </div>
    );
  }

  if (!command) {
    if (docError === 'Command not found') {
      return (
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="font-mono text-sm text-[var(--ctf-red)]">bash: {slug || 'command'}: command not found</p>
          <h1 className="mt-4 font-display text-3xl font-semibold text-[var(--text-heading)]">
            No entry for that command
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
            It is not in the LinuxDocs dataset. Search with Ctrl K, or browse the reference from the home page.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/"
              className="rounded-lg bg-[var(--terminal-green)] px-5 py-2.5 font-mono text-sm font-semibold text-[var(--bg)] hover:bg-[var(--terminal-green-dim)]"
            >
              Home
            </Link>
            <Link
              to="/ctf"
              className="rounded-lg border border-[var(--ctf-red)]/45 px-5 py-2.5 font-mono text-sm font-semibold text-[var(--ctf-red)] hover:bg-[var(--ctf-red-bg)]"
            >
              CTF tools
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="font-mono text-sm text-[var(--ctf-red)]">{docError || 'Something went wrong loading this page.'}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 inline-block rounded-lg border border-[var(--border)] px-5 py-2.5 font-mono text-sm text-[var(--text)] hover:border-[var(--terminal-green)]/50"
        >
          Retry
        </button>
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
    <div className="mx-auto max-w-7xl px-4 py-10 text-left sm:px-6 lg:px-8" onKeyDown={handleKeyDown}>
      <Breadcrumbs
        items={[
          { label: isCTF ? 'CTF & Security' : 'Linux Reference', to: isCTF ? '/ctf' : '/' },
          { label: parentName, to: isCTF ? `/ctf/${command.category}` : `/linux/${command.category}` },
          { label: command.name },
        ]}
      />

      <div className="flex flex-col gap-10 xl:flex-row">
        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-12">
          {/* Header */}
          <header className="space-y-5 border-b border-[var(--border)] pb-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] ${
                  isCTF
                    ? 'border-[var(--ctf-red)]/35 bg-[var(--ctf-red-bg)] text-[var(--ctf-red)]'
                    : 'border-[var(--terminal-green)]/35 bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]'
                }`}
              >
                {isCTF ? <Shield className="h-3.5 w-3.5" /> : <Terminal className="h-3.5 w-3.5" />}
                {isCTF ? 'CTF tool' : 'Linux utility'}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">{parentName}</span>
              {docsPendingReview && (
                <span
                  className="inline-flex items-center gap-1.5 rounded border border-dashed border-[var(--border)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]"
                  title="This entry's documentation is thin and queued for review. If something looks off, use the correction link below."
                  data-docs-pending-review
                >
                  <FileQuestion className="h-3.5 w-3.5" />
                  Docs pending review
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <h1 className="min-w-0 flex-1 font-display text-5xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-6xl">
                {command.name}
              </h1>
              {slug && (
                <button
                  onClick={handleToggleBookmark}
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 ${
                    isBookmarked
                      ? 'border-[var(--terminal-green)] bg-[var(--terminal-green)] text-[var(--bg)]'
                      : 'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:border-[var(--terminal-green)]/60 hover:text-[var(--terminal-green)]'
                  }`}
                  aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                  title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                >
                  {isBookmarked ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}
                  <span className="hidden font-mono text-xs sm:inline">
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </span>
                </button>
              )}
            </div>

            <p className="max-w-[70ch] text-lg leading-relaxed text-[var(--text-muted)]">{command.summary}</p>

            {command.warnings && (
              <div className="flex items-start gap-3 rounded-xl border border-[var(--amber-warning)]/40 bg-[var(--amber-warning-bg)] p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--amber-warning)]" />
                <div className="space-y-1">
                  <strong className="block font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--amber-warning)]">
                    Warning / ethics notice
                  </strong>
                  <span className="text-sm leading-relaxed text-[var(--text)]">{command.warnings}</span>
                </div>
              </div>
            )}
          </header>

          {/* Notes for signed-in users */}
          {user && (
            <section
              id="notes"
              className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-heading)]">
                  <FileText className="h-5 w-5 text-[var(--terminal-green)]" />
                  Your notes
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs ${noteSaving ? 'text-[var(--amber-warning)]' : 'text-[var(--text-muted)]'}`}>
                    {noteSaving ? 'Saving…' : 'Auto-saves after 1s'}
                  </span>
                  <button
                    onClick={handleSaveNote}
                    disabled={noteSaving || !localNote.trim()}
                    className="flex items-center gap-1 rounded-lg bg-[var(--terminal-green)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--bg)] hover:bg-[var(--terminal-green-dim)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Save</span>
                  </button>
                </div>
              </div>
              <textarea
                ref={noteTextareaRef}
                value={localNote}
                onChange={(e) => handleNoteChange(e.target.value)}
                placeholder="Notes for this command… (Ctrl+S to save)"
                className="min-h-[120px] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 py-3 font-mono text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:border-[var(--terminal-green)]"
                rows={6}
                spellCheck={false}
              />
              {localNote.trim() && (
                <p className="font-mono text-xs text-[var(--text-muted)]">
                  Press{' '}
                  <kbd className="rounded border border-[var(--border)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5">
                    Ctrl+S
                  </kbd>{' '}
                  to save
                </p>
              )}
            </section>
          )}

          {commandBuilderSpecs[command.slug] && <CommandBuilder spec={commandBuilderSpecs[command.slug]} />}

          {/* Overview */}
          <section id="overview" className="scroll-mt-24 space-y-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">Description</h2>
            <p className="max-w-[70ch] text-sm leading-relaxed text-[var(--text)]">{command.description}</p>
          </section>

          {/* Syntax */}
          <section id="syntax" className="scroll-mt-24 space-y-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">Syntax</h2>
            <CodeBlock code={command.syntax} language="bash" />
          </section>

          {/* Options & Flags */}
          {command.options.length > 0 && (
            <section id="options" className="scroll-mt-24 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">
                Common options &amp; flags
              </h2>
              <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[var(--border)] bg-[var(--bg-surface-elevated)]">
                    <tr className="font-mono uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      <th className="p-3 font-semibold">Flag</th>
                      <th className="p-3 font-semibold">Description</th>
                      <th className="p-3 font-semibold">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {command.options.map((opt, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-surface-hover)]">
                        <td className="whitespace-nowrap p-3 font-mono font-semibold text-[var(--terminal-green)]">
                          {opt.flag}
                        </td>
                        <td className="p-3 leading-relaxed text-[var(--text)]">{opt.description}</td>
                        <td className="whitespace-nowrap p-3 font-mono text-[var(--text-muted)]">
                          {opt.example ? <code>{opt.example}</code> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Examples */}
          <section id="examples" className="scroll-mt-24 space-y-6">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">Practical examples</h2>
            <div className="space-y-5">
              {command.examples.map((ex, i) => (
                <article
                  key={i}
                  className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5"
                >
                  <h3 className="flex items-center gap-2.5 font-display text-lg font-semibold text-[var(--text-heading)]">
                    <span className="font-mono text-sm text-[var(--terminal-green)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {ex.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">{ex.explanation}</p>
                  <CodeBlock code={ex.command} />
                  {ex.output && (
                    <div className="space-y-1">
                      <span className="block font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Sample output
                      </span>
                      <pre className="overflow-x-auto rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] p-3 font-mono text-xs text-[var(--text-muted)]">
                        {ex.output}
                      </pre>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* Use cases */}
          <section id="use-cases" className="scroll-mt-24 space-y-3">
            <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">Primary use cases</h2>
            <ul className="space-y-2">
              {command.useCases.map((uc, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-[var(--text)]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--terminal-green)]" />
                  <span>{uc}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Related */}
          {command.related.length > 0 && (
            <section id="related" className="scroll-mt-24 space-y-4 border-t border-[var(--border)] pt-6">
              <h2 className="font-display text-2xl font-semibold text-[var(--text-heading)]">Related utilities</h2>
              <div className="flex flex-wrap gap-2">
                {command.related.map((relSlug) => {
                  const relLight = lights.find((light) => light.slug === relSlug);
                  if (!relLight) return null;
                  return (
                    <Link
                      key={relSlug}
                      to={getPathForLight(relLight)}
                      className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs text-[var(--text)] hover:border-[var(--terminal-green)]/50 hover:text-[var(--terminal-green)]"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      {relLight.name}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tags + feedback */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--text-muted)]">
            <Tag className="h-3.5 w-3.5" />
            <span>Tags</span>
            {command.tags.map((t) => (
              <span key={t} className="rounded border border-[var(--border)] bg-[var(--bg-surface-elevated)] px-2 py-0.5">
                #{t}
              </span>
            ))}
          </div>

          <p className="text-xs text-[var(--text-muted)]">
            Spotted a mistake?{' '}
            <a
              href={`mailto:maintainers@linuxdocs.local?subject=${encodeURIComponent(`Correction: ${command.name}`)}&body=${encodeURIComponent(`Command: ${command.name}\nWhat should be corrected:\n`)}`}
              className="text-[var(--terminal-green)] hover:underline"
            >
              Report it
            </a>
            .
          </p>
        </div>

        {/* Table of contents */}
        <TableOfContents items={tocItems} />
      </div>
    </div>
  );
};
