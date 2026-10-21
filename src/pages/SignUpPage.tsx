import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STRENGTH_CHECKS = [
  { label: 'At least 10 characters', test: (p: string) => p.length >= 10 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /\d/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const { register, user, loading: authLoading } = useAuth();

  // Already signed up? Skip straight to the home page instead of showing this form.
  useEffect(() => {
    if (!authLoading && user) navigate('/', { replace: true });
  }, [authLoading, user, navigate]);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const validateField = (name: string, value: string) => {
    const newErrors = { ...errors };
    switch (name) {
      case 'username':
        if (!value) newErrors.username = 'Username is required';
        else if (value.length < 3 || value.length > 50) newErrors.username = 'Username must be 3-50 characters';
        else if (!/^[a-zA-Z0-9_-]+$/.test(value)) newErrors.username = 'Only letters, numbers, underscore, hyphen allowed';
        else delete newErrors.username;
        break;
      case 'email':
        if (!value) newErrors.email = 'Email is required';
        else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) newErrors.email = 'Invalid email format';
        else delete newErrors.email;
        break;
      case 'password':
        if (!value) newErrors.password = 'Password is required';
        else if (value.length < 10) newErrors.password = 'Password must be at least 10 characters';
        else if (!/[A-Z]/.test(value)) newErrors.password = 'Must contain an uppercase letter';
        else if (!/[a-z]/.test(value)) newErrors.password = 'Must contain a lowercase letter';
        else if (!/\d/.test(value)) newErrors.password = 'Must contain a number';
        else if (!/[^A-Za-z0-9]/.test(value)) newErrors.password = 'Must contain a special character';
        else delete newErrors.password;
        break;
      case 'confirmPassword':
        if (value !== password) newErrors.confirmPassword = 'Passwords do not match';
        else delete newErrors.confirmPassword;
        break;
    }
    setErrors(newErrors);
  };

  const validateAll = () => {
    validateField('username', username);
    validateField('email', email);
    validateField('password', password);
    validateField('confirmPassword', confirmPassword);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    setLoading(true);
    setErrors({});
    const result = await register({ username, email, password, confirm_password: confirmPassword });
    setLoading(false);

    if (result.errors) {
      setErrors(result.errors);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 500);
    }
  };

  const passedChecks = STRENGTH_CHECKS.filter((c) => c.test(password)).length;
  const strengthPercent = (passedChecks / STRENGTH_CHECKS.length) * 100;
  const strengthColor = passedChecks <= 2 ? 'bg-red-500' : passedChecks <= 4 ? 'bg-amber-500' : 'bg-[var(--terminal-green)]';
  const strengthLabel = passedChecks <= 2 ? 'Weak' : passedChecks <= 4 ? 'Medium' : 'Strong';

  const inputClass = 'w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--terminal-green)] focus:ring-1 focus:ring-[var(--terminal-green)] font-mono text-sm transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="terminal-window bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
          <div className="terminal-header bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--ctf-red)]/70"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--amber-warning)]/70"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--terminal-green)]/70"></span>
            <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">signup.sh</span>
          </div>

          <div className="terminal-body p-6 sm:p-8">
            <div className="mb-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="p-2 rounded-lg bg-[var(--terminal-green-bg)] text-[var(--terminal-green)]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                </div>
              </div>
              <h1 className="font-display text-3xl font-semibold text-[var(--text-heading)]">Create account</h1>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Bookmark commands and save notes across devices</p>
            </div>

            {success && (
              <div className="mb-6 p-3 bg-[var(--terminal-green-bg)] border border-[var(--terminal-green)]/30 rounded-lg flex items-center gap-2 text-[var(--terminal-green)] text-sm font-mono">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>Account created. Redirecting…</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); validateField('username', e.target.value); }}
                    onBlur={() => validateField('username', username)}
                    className={`${inputClass} pl-10 ${errors.username ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="johndoe"
                    disabled={loading || success}
                    aria-invalid={errors.username ? 'true' : 'false'}
                    aria-describedby={errors.username ? 'username-error' : undefined}
                  />
                </div>
                {errors.username && (
                  <p id="username-error" className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.username}
                  </p>
                )}
              </div>

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
                    onChange={(e) => { setEmail(e.target.value); validateField('email', e.target.value); }}
                    onBlur={() => validateField('email', email)}
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
                <label htmlFor="password" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); validateField('password', e.target.value); }}
                    onBlur={() => validateField('password', password)}
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

                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[var(--text-muted)] font-mono">Strength: <span className={strengthColor}>{strengthLabel}</span></span>
                    <span className="font-mono text-[var(--text-muted)]">{passedChecks}/5</span>
                  </div>
                  <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${strengthColor}`}
                      style={{ width: `${strengthPercent}%` }}
                    />
                  </div>
                  <ul className="mt-2 space-y-1 text-xs font-mono">
                    {STRENGTH_CHECKS.map((check, i) => (
                      <li key={i} className={`flex items-center gap-2 ${check.test(password) ? 'text-[var(--terminal-green)]' : 'text-[var(--text-muted)]'}`}>
                        {check.test(password) ? <CheckCircle className="w-3 h-3 flex-shrink-0" /> : <XCircle className="w-3 h-3 flex-shrink-0" />}
                        {check.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); validateField('confirmPassword', e.target.value); }}
                    onBlur={() => validateField('confirmPassword', confirmPassword)}
                    className={`${inputClass} pl-10 ${errors.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder="••••••••"
                    disabled={loading || success}
                    aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                    aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
                  />
                </div>
                {errors.confirmPassword && (
                  <p id="confirm-error" className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                    <AlertCircle className="w-3 h-3" />
                    {errors.confirmPassword}
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
                    <span>Creating account...</span>
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-[var(--text-muted)] font-mono">
              Already have an account?{' '}
              <Link to="/sign-in" className="text-[var(--terminal-green)] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};