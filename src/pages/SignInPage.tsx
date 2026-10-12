import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SignInPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const from = (location.state as any)?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) newErrors.email = 'Invalid email format';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    const result = await login(email, password, remember);
    setLoading(false);

    if (result.errors) {
      setErrors(result.errors);
    } else {
      setSuccess(true);
      setTimeout(() => navigate(from, { replace: true }), 500);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--terminal-green)] focus:ring-1 focus:ring-[var(--terminal-green)] font-mono text-sm transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="terminal-window bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
          <div className="terminal-header bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">signin.sh</span>
          </div>

          <div className="terminal-body p-6 sm:p-8">
            <div className="mb-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
              </div>
              <h1 className="font-mono text-2xl font-bold text-[var(--text-heading)]">Sign In</h1>
              <p className="text-[var(--text-muted)] text-sm mt-1">Access your LinuxDocs account</p>
            </div>

            {success && (
              <div className="mb-6 p-3 bg-[var(--terminal-green-bg)] border border-[var(--terminal-green)]/30 rounded-lg flex items-center gap-2 text-[var(--terminal-green)] text-sm font-mono">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Welcome back! Redirecting...</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={validate}
                    className={`${inputClass} pl-10 ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="you@example.com"
                    disabled={loading || success}
                    aria-invalid={errors.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-[var(--text)] font-mono">
                    Password
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg)] text-[var(--terminal-green)] focus:ring-[var(--terminal-green)] focus:ring-1"
                    />
                    <span className="font-mono">Remember me</span>
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={validate}
                    className={`${inputClass} pl-10 pr-12 ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="••••••••"
                    disabled={loading || success}
                    aria-invalid={errors.password ? 'true' : 'false'}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.password}
                  </p>
                )}
              </div>

              {errors.general && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm font-mono flex items-center gap-2" role="alert">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.general}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || success}
                className="w-full py-3 px-4 bg-[var(--terminal-green)] text-[var(--bg)] font-mono font-semibold rounded-lg hover:bg-[var(--terminal-green-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--text-muted)] font-mono">
              Don't have an account?{' '}
              <Link to="/sign-up" className="text-[var(--terminal-green)] hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};