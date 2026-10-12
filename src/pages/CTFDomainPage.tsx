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
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-mono space-y-4">
        <h1 className="text-3xl font-bold text-[var(--text-heading)]">Domain Not Found</h1>
        <p className="text-[var(--text-muted)]">The CTF domain "{domainId}" was not found.</p>
        <Link to="/ctf" className="inline-block px-6 py-2.5 rounded-lg bg-[var(--ctf-red)] text-white font-bold text-xs">
          Return to CTF Section
        </Link>
      </div>
    );
  }

  const toolsInDomain = COMMANDS.filter((c) => c.section === 'ctf' && c.category === domain.id);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 text-left space-y-10">
      <Breadcrumbs items={[{ label: 'CTF & Security', to: '/ctf' }, { label: domain.name }]} />

      <div className="space-y-3 border-b border-[var(--border)] pb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] text-xs font-mono font-bold">
          <Shield className="w-3.5 h-3.5" />
          <span>CTF Domain</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-[var(--text-heading)]">{domain.name}</h1>
        <p className="text-base text-[var(--text-muted)] leading-relaxed">{domain.description}</p>
      </div>

      {/* Domain Command Tools */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-mono text-[var(--text-heading)] flex items-center gap-2">
          <Wrench className="w-5 h-5 text-[var(--ctf-red)]" />
          <span>Documented Command Line Tools</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {toolsInDomain.map((cmd) => (
            <Link
              key={cmd.slug}
              to={getPathForCommand(cmd)}
              className="group p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--ctf-red)]/60 transition-all flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-base text-[var(--text-heading)] group-hover:text-[var(--ctf-red)] transition-colors">
                    {cmd.name}
                  </span>
                  <code className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--code-bg)] px-2 py-0.5 rounded border border-[var(--border)]">
                    {cmd.category}
                  </code>
                </div>
                <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">{cmd.summary}</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-xs font-mono text-[var(--ctf-red)] font-semibold">
                <span>View tool guide</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recommended External Tools Section */}
      <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] space-y-4 shadow-sm">
        <h2 className="text-lg font-bold font-mono text-[var(--text-heading)] flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-[var(--ctf-red)]" />
          <span>Recommended External Tools & Web Services</span>
        </h2>
        <div className="divide-y divide-[var(--border-subtle)]">
          {domain.recommendedExternalTools.map((ext, idx) => (
            <div key={idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
              <div className="space-y-0.5">
                <a
                  href={ext.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-[var(--ctf-red)] hover:underline flex items-center gap-1.5"
                >
                  <span>{ext.name}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <p className="text-[var(--text-muted)] font-sans">{ext.description}</p>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] px-2 py-0.5 rounded border border-[var(--border)] shrink-0 self-start sm:self-center">
                {ext.url.replace('https://', '').replace('http://', '').split('/')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
