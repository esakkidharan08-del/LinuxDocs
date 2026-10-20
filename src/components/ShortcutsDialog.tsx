import { useEffect } from 'react';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Ctrl K', label: 'Open command search' },
  { keys: '?', label: 'Show this guide' },
  { keys: 'Ctrl S', label: 'Save a command note' },
  { keys: 'Esc', label: 'Close overlays' },
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl animate-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <h2 id="shortcuts-title" className="font-display text-lg text-[var(--text-heading)]">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] px-2 py-1 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            Esc
          </button>
        </div>
        <dl className="divide-y divide-[var(--border-subtle)]">
          {SHORTCUTS.map((item) => (
            <div key={item.keys} className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="text-sm text-[var(--text)]">{item.label}</dt>
              <dd>
                <kbd className="rounded-md border border-[var(--border)] bg-[var(--bg-surface-elevated)] px-2 py-1 font-mono text-[11px] text-[var(--text-muted)]">
                  {item.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
