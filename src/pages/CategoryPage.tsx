import { useParams, Link } from 'react-router-dom';
import { getCategory, COMMANDS, getPathForCommand } from '../data/commands';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Terminal, ArrowRight } from 'lucide-react';

export const CategoryPage = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const category = getCategory(categoryId || '');

  if (!category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4 font-mono">
        <h1 className="text-3xl font-bold text-[var(--text-heading)]">Category Not Found</h1>
        <p className="text-[var(--text-muted)]">The requested category "{categoryId}" does not exist in our database.</p>
        <Link to="/" className="inline-block px-6 py-2.5 rounded-lg bg-[var(--terminal-green)] text-slate-950 font-bold text-sm">
          Return to Home
        </Link>
      </div>
    );
  }

  const commandsInCat = COMMANDS.filter((c) => c.section === 'linux' && c.category === category.id);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-left space-y-8">
      <Breadcrumbs items={[{ label: 'Linux Reference' }, { label: category.name }]} />

      <div className="space-y-3 border-b border-[var(--border)] pb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--terminal-green-bg)] text-[var(--terminal-green)] text-xs font-mono font-semibold">
          <Terminal className="w-3.5 h-3.5" />
          <span>Linux Category</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-[var(--text-heading)]">{category.name}</h1>
        <p className="text-base text-[var(--text-muted)] leading-relaxed">{category.description}</p>
        <div className="text-xs font-mono text-[var(--text-muted)]">
          {commandsInCat.length} command{commandsInCat.length === 1 ? '' : 's'} available in this category.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {commandsInCat.map((cmd) => (
          <Link
            key={cmd.slug}
            to={getPathForCommand(cmd)}
            className="group p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--terminal-green)]/60 transition-all flex flex-col justify-between space-y-4 shadow-sm"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-base text-[var(--text-heading)] group-hover:text-[var(--terminal-green)] transition-colors">
                  {cmd.name}
                </span>
                <code className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--code-bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                  {cmd.syntax.split(' ')[0]}
                </code>
              </div>
              <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">{cmd.summary}</p>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-mono text-[var(--terminal-green)]">
              <span>View reference</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
