import React, { useEffect, useState } from 'react';

export interface TocItem {
  id: string;
  label: string;
}

interface TableOfContentsProps {
  items: TocItem[];
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({ items }) => {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      for (let i = items.length - 1; i >= 0; i--) {
        const el = document.getElementById(items[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveId(items[i].id);
          return;
        }
      }
      if (items.length > 0) setActiveId(items[0].id);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <div className="hidden xl:block w-64 shrink-0 pl-8 sticky top-24 self-start text-xs font-mono">
      <div className="border-l border-[var(--border)] pl-4 py-1 space-y-2.5">
        <span className="text-[11px] font-bold tracking-wider uppercase text-[var(--text-muted)] block mb-3">
          On this page
        </span>
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block transition-colors ${
              activeId === item.id
                ? 'text-[var(--terminal-green)] font-semibold -ml-[17px] pl-4 border-l-2 border-[var(--terminal-green)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  );
};
