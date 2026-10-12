import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbsProps {
  items: { label: string; to?: string }[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center space-x-2 text-xs font-mono text-[var(--text-muted)] mb-6 overflow-x-auto whitespace-nowrap py-1">
      <Link to="/" className="hover:text-[var(--text)] flex items-center gap-1">
        <Home className="w-3.5 h-3.5" />
        <span>home</span>
      </Link>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]/50 shrink-0" />
          {item.to ? (
            <Link to={item.to} className="hover:text-[var(--text)]">
              {item.label}
            </Link>
          ) : (
            <span className="text-[var(--text-heading)] font-semibold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
