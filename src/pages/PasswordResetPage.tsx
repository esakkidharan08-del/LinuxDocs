import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { authApi } from '../services/api';

export const PasswordResetPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);

  const requestReset = async (event: FormEvent) => { event.preventDefault(); setError(''); try { const result = await authApi.requestPasswordReset(email); setRequested(true); setMessage(result.email_configured ? `${result.message} Check your inbox (and spam folder) — the link is valid for 30 minutes.` : `${result.message} This deployment has no email provider configured, so no message can be sent right now.`); } catch (err: any) { setError(err.message); } };
  const reset = async (event: FormEvent) => { event.preventDefault(); setError(''); try { await authApi.resetPassword({ token, password, confirm_password: confirm }); setMessage('Password reset. You can sign in now.'); setTimeout(() => navigate('/sign-in'), 700); } catch (err: any) { setError(Object.values(err.errors || {}).join(' ') || err.message); } };

  return <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12"><div className="w-full space-y-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6"><h1 className="font-display text-2xl font-semibold text-[var(--text-heading)]">{token ? 'Set a new password' : 'Reset your password'}</h1>{message && <p className="rounded bg-[var(--terminal-green-bg)] p-3 text-sm text-[var(--terminal-green)]">{message}</p>}{error && <p className="rounded bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}{token ? <form onSubmit={reset} className="space-y-4"><label className="block space-y-1 text-sm"><span>New password</span><div className="relative"><Lock className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" /><input required minLength={10} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 pl-10" /></div></label><label className="block space-y-1 text-sm"><span>Confirm password</span><input required minLength={10} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3" /></label><button className="w-full rounded-lg bg-[var(--terminal-green)] p-3 font-mono font-bold text-[var(--bg)]">Reset password</button></form> : <form onSubmit={requestReset} className="space-y-4"><label className="block space-y-1 text-sm"><span>Email</span><div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 pl-10" placeholder="you@example.com" /></div></label><button disabled={requested} className="w-full rounded-lg bg-[var(--terminal-green)] p-3 font-mono font-bold text-[var(--bg)] disabled:opacity-50">Send reset link</button><p className="text-xs text-[var(--text-muted)]">If an account exists for that email, a one-time link is sent by email; it expires after 30 minutes.</p></form>}<Link to="/sign-in" className="block text-center font-mono text-sm text-[var(--terminal-green)] hover:underline">Back to sign in</Link></div></div>;
};
