import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  items: { label: string; to?: string }[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-6 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1 font-mono text-xs text-[var(--text-muted)]"
    >
      <Link to="/" className="flex items-center gap-1 hover:text-[var(--text)]" aria-label="Home">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight className="h-3 w-3 shrink-0 text-[var(--text-muted)]/40" />
          {item.to ? (
            <Link to={item.to} className="hover:text-[var(--text)]">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-[var(--text-heading)]">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
