import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
}

export const CodeBlock = ({ code, language = 'bash', showCopy = true }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="terminal-window group relative my-3 overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--code-border)] px-3.5 py-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {language}
        </span>
        {showCopy && (
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] text-[var(--text-muted)] opacity-70 hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text)] focus-visible:opacity-100 group-hover:opacity-100"
            aria-label="Copy code to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[var(--terminal-green)]" />
                <span className="text-[var(--terminal-green)]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
      <pre className="overflow-x-auto bg-[var(--code-bg)] p-4 font-mono text-sm leading-relaxed text-[var(--text)]">
        <code>{code}</code>
      </pre>
    </div>
  );
};
