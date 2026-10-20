import { useParams, Link } from 'react-router-dom';
import { getCategory, COMMANDS, getPathForCommand } from '../data/commands';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Terminal, ArrowRight } from 'lucide-react';

export const CategoryPage = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = getCategory(categoryId || '');

  if (!category) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="font-mono text-sm text-[var(--text-muted)]">
          bash: cd: {categoryId}: No such file or directory
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-[var(--text-heading)]">Category not found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
          That category is not part of the reference. Browse the full index instead.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-lg bg-[var(--terminal-green)] px-5 py-2.5 font-mono text-sm font-semibold text-[var(--bg)] hover:bg-[var(--terminal-green-dim)]"
        >
          Back to the index
        </Link>
      </div>
    );
  }

  const commandsInCat = COMMANDS.filter((c) => c.section === 'linux' && c.category === category.id);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'Linux Reference', to: '/' }, { label: category.name }]} />

      <header className="space-y-4 border-b border-[var(--border)] pb-8">
        <span className="inline-flex items-center gap-2 border border-[var(--terminal-green)]/30 bg-[var(--terminal-green-bg)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--terminal-green)]">
          <Terminal className="h-3.5 w-3.5" />
          Linux category
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-5xl">
          {category.name}
        </h1>
        <p className="max-w-[62ch] text-base leading-relaxed text-[var(--text-muted)]">{category.description}</p>
        <p className="font-mono text-xs text-[var(--text-muted)]">
          {commandsInCat.length} {commandsInCat.length === 1 ? 'command' : 'commands'} in this category
        </p>
      </header>

      {commandsInCat.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-12 text-center">
          <p className="font-display text-lg text-[var(--text-heading)]">Nothing documented here yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">
            This category is reserved but has no entries. Try another section from the sidebar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {commandsInCat.map((cmd, index) => (
            <Link
              key={cmd.slug}
              to={getPathForCommand(cmd)}
              className="group flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 hover:-translate-y-0.5 hover:border-[var(--terminal-green)]/50"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-display text-lg font-semibold text-[var(--text-heading)] group-hover:text-[var(--terminal-green)]">
                  {cmd.name}
                </span>
                <span className="font-mono text-[11px] text-[var(--text-muted)]">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              <code className="w-fit rounded border border-[var(--border)] bg-[var(--code-bg)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)]">
                {cmd.syntax.split(' ')[0]}
              </code>
              <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">{cmd.summary}</p>
              <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 font-mono text-xs text-[var(--terminal-green)]">
                <span>View reference</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
