import { useState, useEffect } from 'react';
import { Terminal, Shield, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { COMMANDS, LINUX_CATEGORIES, CTF_DOMAINS } from '../data/commands';

export const LandingPage = () => {
  const [currentCmdIndex, setCurrentCmdIndex] = useState(0);

  const sampleCommands = [
    { cmd: 'nmap -sC -sV 10.10.11.120', output: 'PORT 22/tcp open ssh\nPORT 80/tcp open http' },
    { cmd: 'grep -rn "TODO" src/', output: 'src/App.tsx:14: // TODO: refactor\nsrc/main.tsx:5: // TODO: config' },
    { cmd: 'sqlmap -u "http://target.htb/vuln.php?id=1" --dbs', output: '[INFO] fetching current database: ctf_db' },
    { cmd: 'tar -czvf backup.tar.gz /var/www/', output: 'tar: Removing leading / from member names\nBackup completed successfully.' },
    { cmd: 'journalctl -u nginx.service -n 5', output: 'Oct 12 10:00:01 server nginx[120]: Started A high performance web server.' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCmdIndex((prev) => (prev + 1) % sampleCommands.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const totalLinuxCount = COMMANDS.filter((c) => c.section === 'linux').length;
  const totalCTFCount = COMMANDS.filter((c) => c.section === 'ctf').length;

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 border-b border-[var(--border)] overflow-hidden bg-gradient-to-b from-[var(--bg-surface)] to-[var(--bg)]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--terminal-green)]/40 bg-[var(--terminal-green-bg)] text-[var(--terminal-green)] text-xs font-mono font-medium">
            <span className="w-2 h-2 rounded-full bg-[var(--terminal-green)] animate-ping" />
            MDN-Style Linux & CTF Command Reference
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-[var(--text-heading)] tracking-tight font-mono">
            Master the Terminal.<br />
            <span className="text-[var(--terminal-green)]">Conquer CTF Challenges.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-[var(--text-muted)]">
            A comprehensive, accurate, developer-focused reference for {totalLinuxCount}+ Linux system utilities and {totalCTFCount}+ CTF hacking & security tools. Complete with real syntax, options, and realistic output.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/linux/file-and-directory/ls"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-[var(--terminal-green)] text-slate-950 font-mono font-bold text-sm hover:bg-[var(--terminal-green-dim)] transition-colors shadow-lg shadow-[var(--terminal-green)]/20"
            >
              <Terminal className="w-4 h-4" />
              <span>Explore Linux Commands</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/ctf/recon/nmap"
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-[var(--ctf-red)]/50 bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] font-mono font-bold text-sm hover:bg-[var(--ctf-red)]/20 transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>CTF Security Section</span>
            </Link>
          </div>
        </div>

        {/* Animated Terminal Simulator Demo */}
        <div className="max-w-3xl mx-auto mt-12 rounded-xl border border-[var(--border)] bg-[var(--code-bg)] shadow-2xl overflow-hidden font-mono text-left">
          <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-surface-elevated)] border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            </div>
            <span className="text-xs text-[var(--text-muted)]">bash — linuxdocs@terminal:~</span>
            <span className="text-xs text-[var(--terminal-green)] font-semibold">live</span>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <div className="flex items-center gap-2 text-[var(--terminal-green)]">
              <span>$</span>
              <span className="text-[var(--text-heading)] font-semibold">{sampleCommands[currentCmdIndex].cmd}</span>
            </div>
            <pre className="text-[var(--text-muted)] text-xs leading-relaxed whitespace-pre-wrap pl-4 border-l-2 border-[var(--border)]">
              {sampleCommands[currentCmdIndex].output}
            </pre>
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-center space-y-2">
            <div className="text-3xl font-extrabold font-mono text-[var(--terminal-green)]">{totalLinuxCount}+</div>
            <div className="text-sm font-medium text-[var(--text-muted)]">Verified Linux Commands</div>
          </div>
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-center space-y-2">
            <div className="text-3xl font-extrabold font-mono text-[var(--ctf-red)]">{totalCTFCount}+</div>
            <div className="text-sm font-medium text-[var(--text-muted)]">CTF & Security Tools</div>
          </div>
          <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-center space-y-2">
            <div className="text-3xl font-extrabold font-mono text-amber-400">100%</div>
            <div className="text-sm font-medium text-[var(--text-muted)]">Accurate Syntax & Examples</div>
          </div>
        </div>
      </section>

      {/* Linux Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-mono text-[var(--text-heading)]">Linux Reference Categories</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">Explore essential system administration and file management utilities.</p>
          </div>
          <Link to="/linux/file-and-directory/ls" className="text-sm font-mono text-[var(--terminal-green)] hover:underline flex items-center gap-1">
            <span>View all</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LINUX_CATEGORIES.map((cat) => {
            const count = COMMANDS.filter((c) => c.section === 'linux' && c.category === cat.id).length;
            return (
              <Link
                key={cat.id}
                to={`/linux/${cat.id}`}
                className="group p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--terminal-green)]/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--terminal-green-bg)] text-[var(--terminal-green)] font-semibold">
                      {count} commands
                    </span>
                    <Terminal className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--terminal-green)] transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold font-mono text-[var(--text-heading)] group-hover:text-[var(--terminal-green)] transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">{cat.description}</p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-xs font-mono text-[var(--terminal-green)] font-medium">
                  <span>Browse category</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTF Security Domains Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-mono text-[var(--text-heading)]">CTF & Security Domains</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">Penetration testing, reverse engineering, forensics, and cryptography tools.</p>
          </div>
          <Link to="/ctf/recon/nmap" className="text-sm font-mono text-[var(--ctf-red)] hover:underline flex items-center gap-1">
            <span>View CTF home</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CTF_DOMAINS.map((domain) => {
            const count = COMMANDS.filter((c) => c.section === 'ctf' && c.category === domain.id).length;
            return (
              <Link
                key={domain.id}
                to={`/ctf/${domain.id}`}
                className="group p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--ctf-red)]/50 transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-[var(--ctf-red-bg)] text-[var(--ctf-red)] font-semibold">
                      {count} tools
                    </span>
                    <Shield className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--ctf-red)] transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold font-mono text-[var(--text-heading)] group-hover:text-[var(--ctf-red)] transition-colors">
                    {domain.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed">{domain.description}</p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-xs font-mono text-[var(--ctf-red)] font-medium">
                  <span>Explore domain</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
};
