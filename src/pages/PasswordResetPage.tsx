import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { authApi } from '../services/api';

type ChallengeQuestion = { prompt: string; options: string[]; tag?: string };
type Step = 'email' | 'quiz' | 'password' | 'done';

/** Knowledge-based password recovery — no email involved.
 *
 * Step 1: enter the account email.
 * Step 2: accounts with learning activity get 10 questions about their OWN
 *         progress (paths, streaks, drill records, bookmarks). 8/10 correct
 *         continues; wrong answer rounds burn one of 3 attempts. Accounts
 *         with no learning data skip straight to step 3.
 * Step 3: set the new password, then sign in. */
export const PasswordResetPage = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [grant, setGrant] = useState('');
  const [questions, setQuestions] = useState<ChallengeQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [timeline, setTimeline] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = (text: string) => {
    setTimeline(text || 'Recovery complete.');
    setStep('done');
    setTimeout(() => navigate('/sign-in'), 1200);
  };

  const start = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await authApi.recoveryStart(email);
      setTimeline(result.message);
      if (result.mode === 'direct') {
        setGrant(result.grant);
        setStep('password');
      } else if (result.mode === 'challenge') {
        const list = result.questions ?? [];
        setGrant(result.grant);
        setQuestions(list);
        setAnswers(new Array(list.length).fill(null));
        setStep('quiz');
      } else {
        setError(result.message || 'Recovery is not available for this email.');
      }
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const verify = async () => {
    setError(''); setBusy(true);
    try {
      const result = await authApi.recoveryVerify(grant, answers.map((a) => a ?? -1));
      if (result.passed) return finish('Identity confirmed.');
      if (result.burned) {
        setError('Too many wrong rounds — please start over with a fresh set of questions.');
        setStep('email'); setGrant(''); setQuestions([]); setAnswers([]);
        return;
      }
      setError(`Not enough correct answers (${result.correct ?? 0}/10) — ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? '' : 's'} left.`);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };

  const complete = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      await authApi.recoveryComplete(grant, password, confirm);
      finish('Password reset. You can sign in with your new password.');
    } catch (err: any) {
      setError(Object.values(err.errors || {}).join(' ') || err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <div className="w-full space-y-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
        <h1 className="font-display text-2xl font-semibold text-[var(--text-heading)]">
          {step === 'email' ? 'Reset your password'
            : step === 'quiz' ? 'Prove it is you'
              : step === 'done' ? 'Recovery complete'
                : 'Set a new password'}
        </h1>

        {timeline && <p className="rounded bg-[var(--terminal-green-bg)] p-3 text-sm text-[var(--terminal-green)]">{timeline}</p>}
        {error && <p className="rounded bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

        {step === 'email' && (
          <form onSubmit={start} className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span>Account email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input required type="email" value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 pl-10"
                  placeholder="you@example.com" />
              </div>
            </label>
            <p className="text-xs text-[var(--text-muted)]">
              Accounts with learning activity answer a 10-question quiz about their own
              progress (8 correct continues). Brand-new accounts skip the quiz.
            </p>
            <button disabled={busy}
              className="w-full rounded-lg bg-[var(--terminal-green)] p-3 font-mono font-bold text-[var(--bg)] disabled:opacity-50">
              Start recovery
            </button>
          </form>
        )}

        {step === 'quiz' && (
          <form onSubmit={(event) => { event.preventDefault(); void verify(); }} className="space-y-5">
            {questions.map((question, index) => (
              <fieldset key={index} className="space-y-2 rounded-lg border border-[var(--border)] p-3">
                <legend className="px-1 font-mono text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  Question {index + 1} of {questions.length}
                </legend>
                <p className="text-sm font-medium leading-snug">{question.prompt}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {question.options.map((option, optIndex) => (
                    <label key={option}
                      className={`flex cursor-pointer items-center gap-2 rounded border px-2.5 py-1.5 text-sm transition-colors ${
                        answers[index] === optIndex
                          ? 'border-[var(--terminal-green)] bg-[var(--terminal-green)]/10'
                          : 'border-[var(--border)] hover:border-[var(--terminal-green)]/50'
                      }`}>
                      <input type="radio" name={`q${index}`} className="accent-[var(--terminal-green)]"
                        checked={answers[index] === optIndex}
                        onChange={() => setAnswers((prev) => prev.map((a, i) => (i === index ? optIndex : a)))} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="text-xs text-[var(--text-muted)]">
              3 rounds of wrong answers burn this set — start over for a fresh one.
            </p>
            <button disabled={busy || answers.some((a) => a === null)}
              className="w-full rounded-lg bg-[var(--terminal-green)] p-3 font-mono font-bold text-[var(--bg)] disabled:opacity-50">
              Check answers
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={complete} className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span>New password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input required minLength={10} type="password" value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 pl-10" />
              </div>
            </label>
            <label className="block space-y-1 text-sm">
              <span>Confirm password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
                <input required minLength={10} type="password" value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 pl-10" />
              </div>
            </label>
            <button disabled={busy}
              className="w-full rounded-lg bg-[var(--terminal-green)] p-3 font-mono font-bold text-[var(--bg)] disabled:opacity-50">
              Reset password
            </button>
          </form>
        )}

        {step === 'done' && (
          <p className="text-center text-sm text-[var(--text-muted)]">Taking you to sign in…</p>
        )}

        <p className="text-center text-sm font-mono">
          <Link to="/sign-in" className="text-[var(--terminal-green)] hover:underline">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default PasswordResetPage;
