import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

type ReadyBody = {
  status: string;
  database: string;
  latency_ms: number;
  mode: string;
};

type ApiStatus = {
  state: 'checking' | 'ready' | 'down';
  label: string;
};

/**
 * Small, non-secret status card for Settings: pings /api/ready once and
 * shows whether the API is reachable and the database answers with its
 * latency + connection mode. Relative URL, so it works everywhere the app
 * works: Vite dev proxy locally, Vercel /api rewrite in production.
 */
export const SystemStatus: React.FC = () => {
  const [status, setStatus] = useState<ApiStatus>({ state: 'checking', label: 'Checking backend…' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ready', { credentials: 'include' });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            state: 'down',
            label: (body && body.error) || 'API or database unreachable',
          });
          return;
        }
        const info = body as ReadyBody;
        setStatus({
          state: 'ready',
          label: `API reachable · database ready · ${info.latency_ms} ms · ${info.mode}`,
        });
      } catch {
        if (!cancelled) {
          setStatus({ state: 'down', label: 'API unreachable' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dotColor = status.state === 'ready'
    ? 'bg-[var(--terminal-green)]'
    : status.state === 'down'
      ? 'bg-red-500'
      : 'bg-yellow-500 animate-pulse';

  return (
    <div className="terminal-window bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
      <div className="terminal-header bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[var(--terminal-green)]" />
          <span className="font-mono text-[var(--text-heading)]">Service Status</span>
        </div>
      </div>
      <div className="terminal-body p-6 flex items-center gap-3" data-testid="system-status">
        <span
          aria-hidden="true"
          className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${dotColor}`}
        />
        <span
          className={`font-mono text-sm ${
            status.state === 'down' ? 'text-red-500' : 'text-[var(--text-muted)]'
          }`}
          role="status"
        >
          {status.label}
        </span>
      </div>
    </div>
  );
};
