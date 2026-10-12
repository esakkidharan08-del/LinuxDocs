import { CTF_DOMAINS, COMMANDS, getPathForCommand } from '../data/commands';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Shield, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CTFHomePage = () => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-left space-y-12">
      <Breadcrumbs items={[{ label: 'CTF & Security Domains' }]} />

      <div className="space-y-4 border-b border-[var(--border)] pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] text-xs font-mono font-bold">
          <Shield className="w-4 h-4" />
          <span>Capture The Flag & Security Tools</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold font-mono text-[var(--text-heading)]">
          CTF Command Reference
        </h1>
        <p className="text-base text-[var(--text-muted)] max-w-3xl leading-relaxed">
          Educational guide and syntax reference for cybersecurity tools used in Capture The Flag competitions and authorized security assessments. Select a domain below to browse tools and recommended external utilities.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CTF_DOMAINS.map((domain) => {
          const tools = COMMANDS.filter((c) => c.section === 'ctf' && c.category === domain.id);
          return (
            <div
              key={domain.id}
              className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--ctf-red)]/50 transition-all flex flex-col justify-between space-y-6 shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] font-semibold">
                    {domain.name}
                  </span>
                  <Shield className="w-5 h-5 text-[var(--ctf-red)]" />
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">{domain.description}</p>

                <div className="space-y-2 pt-2">
                  <span className="text-[11px] font-mono uppercase text-[var(--text-muted)] tracking-wider block">
                    Featured Tools ({tools.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map((t) => (
                      <Link
                        key={t.slug}
                        to={getPathForCommand(t)}
                        className="px-2.5 py-1 rounded border border-[var(--border)] bg-[var(--code-bg)] hover:border-[var(--ctf-red)] text-xs font-mono text-[var(--text)] hover:text-[var(--ctf-red)] transition-all"
                      >
                        {t.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <Link
                  to={`/ctf/${domain.id}`}
                  className="flex items-center justify-between text-xs font-mono text-[var(--ctf-red)] font-bold group"
                >
                  <span>Explore {domain.name} domain</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
