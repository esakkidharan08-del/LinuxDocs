import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  showCopy?: boolean;
}

export const CodeBlock = ({ code, language: _language = 'bash', showCopy = true }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)] overflow-hidden font-mono text-sm my-3">
      {showCopy && (
        <button
          onClick={handleCopy}
          type="button"
          className="absolute top-2 right-2 p-1.5 rounded-md bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-all opacity-80 group-hover:opacity-100 flex items-center gap-1.5 text-xs"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[var(--terminal-green)]" />
              <span className="text-[var(--terminal-green)] font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      )}
      <pre className="p-4 overflow-x-auto text-[var(--text)] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};
