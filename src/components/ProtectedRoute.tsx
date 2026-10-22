import React from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="terminal-window w-full max-w-md mx-4">
          <div className="terminal-header bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--ctf-red)]/70"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--amber-warning)]/70"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--terminal-green)]/70"></span>
          </div>
          <div className="terminal-body p-6 font-mono text-[var(--terminal-green)]">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">$</span>
              <span>Verifying session<span className="blinking">_</span></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    // Sign-in flows round-trip through ?next=<path> so a logged-in session
    // lands exactly where the visitor was headed (deep links included).
    const intended = `${location.pathname}${location.search}`;
    if (searchParams.get('next') !== intended) {
      return <Navigate to={`/sign-in?next=${encodeURIComponent(intended)}`} replace />;
    }
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
};