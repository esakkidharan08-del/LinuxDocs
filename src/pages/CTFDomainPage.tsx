import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCTFDomain, COMMANDS, getPathForCommand } from '../data/commands';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Shield, ExternalLink, ArrowRight, Wrench } from 'lucide-react';

export const CTFDomainPage: React.FC = () => {
  const { domainId } = useParams<{ domainId: string }>();
  const domain = getCTFDomain(domainId || '');

  if (!domain) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="font-mono text-sm text-[var(--text-muted)]">
          bash: cd: {domainId}: No such directory
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold text-[var(--text-heading)]">Domain not found</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[var(--text-muted)]">
          That CTF domain is not part of the reference.
        </p>
        <Link
          to="/ctf"
          className="mt-6 inline-block rounded-lg bg-[var(--ctf-red)] px-5 py-2.5 font-mono text-sm font-semibold text-white hover:bg-[var(--ctf-red-dim)]"
        >
          Back to the CTF index
        </Link>
      </div>
    );
  }

  const toolsInDomain = COMMANDS.filter((c) => c.section === 'ctf' && c.category === domain.id);

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: 'CTF & Security', to: '/ctf' }, { label: domain.name }]} />

      <header className="space-y-4 border-b border-[var(--border)] pb-8">
        <span className="inline-flex items-center gap-2 border border-[var(--ctf-red)]/35 bg-[var(--ctf-red-bg)] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ctf-red)]">
          <Shield className="h-3.5 w-3.5" />
          CTF domain
        </span>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--text-heading)] sm:text-5xl">
          {domain.name}
        </h1>
        <p className="max-w-[62ch] text-base leading-relaxed text-[var(--text-muted)]">{domain.description}</p>
      </header>

      <section className="space-y-5">
        <h2 className="flex items-center gap-2 font-display text-2xl font-semibold text-[var(--text-heading)]">
          <Wrench className="h-5 w-5 text-[var(--ctf-red)]" />
          Documented command line tools
        </h2>

        {toolsInDomain.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-10 text-center">
            <p className="font-display text-lg text-[var(--text-heading)]">No tools documented yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-muted)]">
              This domain only lists external resources below for now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {toolsInDomain.map((cmd, index) => (
              <Link
                key={cmd.slug}
                to={getPathForCommand(cmd)}
                className="group flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 hover:-translate-y-0.5 hover:border-[var(--ctf-red)]/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-display text-lg font-semibold text-[var(--text-heading)] group-hover:text-[var(--ctf-red)]">
                    {cmd.name}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-[var(--text-muted)]">{cmd.summary}</p>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 font-mono text-xs font-semibold text-[var(--ctf-red)]">
                  <span>View tool guide</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-[var(--text-heading)]">
          <ExternalLink className="h-5 w-5 text-[var(--ctf-red)]" />
          Recommended external resources
        </h2>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {domain.recommendedExternalTools.map((ext) => (
            <li key={ext.name} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <a
                  href={ext.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-[var(--ctf-red)] hover:underline"
                >
                  {ext.name}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">{ext.description}</p>
              </div>
              <span className="shrink-0 self-start rounded border border-[var(--border)] bg-[var(--bg-surface-elevated)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)] sm:self-center">
                {ext.url.replace('https://', '').replace('http://', '').split('/')[0]}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
