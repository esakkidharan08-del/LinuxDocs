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
      const scrollPosition = window.scrollY + 120;
      for (let i = items.length - 1; i >= 0; i--) {
        const el = document.getElementById(items[i].id);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveId(items[i].id);
          return;
        }
      }
      if (items.length > 0) setActiveId(items[0].id);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="On this page" className="sticky top-24 hidden w-60 shrink-0 self-start pl-8 xl:block">
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        On this page
      </p>
      <ul className="space-y-2.5 border-l border-[var(--border)] pl-4 font-mono text-xs">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={`block transition-colors ${
                  isActive
                    ? '-ml-[17px] border-l-2 border-[var(--terminal-green)] pl-4 font-semibold text-[var(--terminal-green)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
