import { useCatalog, getPathForLight } from '../context/CatalogContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Shield, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CTFHomePage = () => {
  const { lights, domains, loading: catalogLoading, error: catalogError, clearError } = useCatalog();

  if (catalogLoading && domains.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="font-mono text-sm text-[var(--text-muted)]">
          loading CTF index<span className="blinking">_</span>
        </p>
      </div>
    );
  }

  if (catalogError && domains.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="font-mono text-sm text-[var(--ctf-red)]">{catalogError}</p>
        <button
          type="button"
          onClick={clearError}
          className="mt-4 inline-block rounded-lg border border-[var(--border)] px-5 py-2.5 font-mono text-sm text-[var(--text)] hover:border-[var(--ctf-red)]/50"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'CTF & Security' }]} />

      <header className="space-y-4 border-b border-[var(--border)] pb-8">
        <span className="inline-flex items-center gap-2 border border-[var(--ctf-red)]/35 bg-[var(--ctf-red-bg)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ctf-red)]">
          <Shield className="h-3.5 w-3.5" />
          Capture the flag
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-5xl">
          CTF &amp; security tooling
        </h1>
        <p className="max-w-[64ch] text-base leading-relaxed text-[var(--text-muted)]">
          Syntax references for the tools that turn up in competitions and authorised assessments. Use them on
          machines you own or have written permission to test.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {domains.map((domain, index) => {
          const tools = lights.filter((c) => c.section === 'ctf' && c.category === domain.id);
          return (
            <div
              key={domain.id}
              className="flex flex-col gap-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="font-display text-xl font-semibold text-[var(--text-heading)]">{domain.name}</h2>
                </div>
                <Shield className="h-5 w-5 shrink-0 text-[var(--ctf-red)]" />
              </div>

              <p className="max-w-[58ch] text-sm leading-relaxed text-[var(--text-muted)]">{domain.description}</p>

              <div className="space-y-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {tools.length} documented {tools.length === 1 ? 'tool' : 'tools'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tools.map((t) => (
                    <Link
                      key={t.slug}
                      to={getPathForLight(t)}
                      className="rounded border border-[var(--border)] bg-[var(--code-bg)] px-2.5 py-1 font-mono text-xs text-[var(--text)] hover:border-[var(--ctf-red)]/60 hover:text-[var(--ctf-red)]"
                    >
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="mt-auto border-t border-[var(--border-subtle)] pt-4">
                <Link
                  to={`/ctf/${domain.id}`}
                  className="group flex items-center justify-between font-mono text-xs font-semibold text-[var(--ctf-red)]"
                >
                  <span>Explore {domain.name}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
