/* OnboardingTour — first-visit guided tour of the site.
 *
 * Spotlight walkthrough: dims the page, highlights one UI spot per step and
 * animates a tooltip next to it. Plays once automatically for signed-in
 * users (AppShell) and can be re-run anytime from the compass button in the
 * Header (START_TOUR_EVENT). Steps whose target is missing (e.g. the
 * sidebar on small screens) are dropped when the tour opens, so it degrades
 * gracefully on any viewport.
 *
 * Targets are stable `data-tour="…"` attributes / aria-labels in the shell,
 * not text — nav link labels change, IDs don't.
 */
/* eslint-disable react/only-export-components -- context-style constants are colocated on purpose */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Compass, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DONE_KEY = 'linuxdocs_tour_done';
export const START_TOUR_EVENT = 'linuxdocs:start-tour';

export const isTourDone = (): boolean => {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return true; // storage unavailable → never nag with the auto-start
  }
};

export const markTourDone = (): void => {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // ignore
  }
};

type TourStep = {
  /** CSS selector to spotlight; omit for a centered card (welcome/finish). */
  target?: string;
  title: string;
  body: string;
};

const STEPS: TourStep[] = [
  {
    title: 'Welcome to LinuxDocs',
    body: '60 seconds marks every area of the site on the actual UI — click anywhere or use the arrows to move on.',
  },
  {
    target: '[aria-label="Toggle navigation"]',
    title: 'Everything starts in the ☰ menu',
    body: 'The sidebar lists every study tool — learning paths, flashcards, practice terminal, speed drill, explain a command, cheat sheets, command of the day — plus the full browsable command tree.',
  },
  {
    target: '[data-tour="nav-reference"]',
    title: 'Linux Reference',
    body: '95 utilities in an MDN-style layout: flag tables with examples, expected output, and a Command Builder that assembles real flag strings as you toggle options.',
  },
  {
    target: '[data-tour="nav-ctf"]',
    title: 'CTF & Security',
    body: '37 security tools across 10 domains (recon → cloud). Each domain page also lists curated external starter tools so you know where to go next.',
  },
  {
    target: '[data-tour="nav-cheatsheet"]',
    title: 'Cheat Sheets',
    body: 'Condensed one-page sheets per topic — the quick-recall layer above the full reference.',
  },
  {
    target: '[data-tour="nav-learn"]',
    title: 'Learn — guided paths',
    body: '8 structured paths with 24 lessons and adjustable quizzes: Linux foundations → permissions → processes → systemd.',
  },
  {
    target: '[data-tour="nav-flashcards"]',
    title: 'Flashcards & drills',
    body: 'Flip-style spaced repetition over every utility, a timed Speed Drill, and book-markable daily progress — all synced to your account.',
  },
  {
    target: '[data-tour="theme"]',
    title: 'Light / dark anytime',
    body: 'Click the sun/moon — the screen reveals itself with a radial swoosh.',
  },
  {
    target: '[data-tour="account"]',
    title: 'Your account',
    body: 'Dashboard (bookmarks, notes, progress), Settings (service status + preferences) and sign-out — and every command page saves bookmarks, notes and Ctrl+S autosaved notes to your account.',
  },
  {
    title: 'You are set — power tips',
    body: 'Ctrl+K opens search from anywhere · the "?" key lists every keyboard shortcut · the compass button in the header replays this tour.',
  },
];

type Rect = { x: number; y: number; w: number; h: number };

/** True when the target exists in the DOM and is actually on screen —
 *  desktop-only / auth-conditional targets fail these checks and their
 *  step is dropped (`isCTF` shell, mobile without nav, signed-out account
 *  button, translated-off-canvas sidebar drawer…). */
function liveTargetRect(selector: string): boolean {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el || el.getClientRects().length === 0) return false;
  const r = el.getBoundingClientRect();
  return r.left > -40 && r.right < window.innerWidth + 40 && r.top < window.innerHeight;
}

function OnboardingTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = useMemo(() => {
    // snapshot at open: targets are checked once, not during every scroll
    if (!open) return [];
    return STEPS.filter((s) => !s.target || liveTargetRect(s.target));
  }, [open]);
  const [idx, setIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const reduce = useReducedMotion();
  const step = steps[idx] as TourStep | undefined;

  const recalc = useCallback(() => {
    const el = step?.target ? document.querySelector<HTMLElement>(step.target) : null;
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setTargetRect({ x: r.left, y: r.top, w: r.width, h: r.height });
  }, [step?.target]);

  useEffect(() => setIdx(0), [steps]);

  /* position keeps the spot on screen and re-measures with every scroll /
     resize so spot + tooltip never drift apart */
  useEffect(() => {
    if (!open || !step) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalc);
    };
    const el = step.target ? document.querySelector<HTMLElement>(step.target) : null;
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, { capture: true } as EventListenerOptions);
    };
  }, [open, step, recalc, reduce]);

  /* scroll lock + keys: Esc closes the tour, arrows navigate */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === 'ArrowLeft') setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, steps.length, onClose]);

  const next = () => {
    if (idx >= steps.length - 1) onClose();
    else setIdx((i) => i + 1);
  };

  /* tooltip geometry: prefer under the spot, flip above when tight;
     clamped into the viewport (tooltip assumed ≤ 344px wide). Centered
     cards (no target) sit at the vertical middle of the viewport. */
  const tip = useMemo(() => {
    if (!targetRect) {
      return {
        top: Math.round(window.innerHeight / 2 - 120),
        left: Math.round((window.innerWidth - 344) / 2),
        above: false,
        centered: true,
      };
    }
    const below = window.innerHeight - targetRect.y - targetRect.h > 170;
    const left = Math.max(12, Math.min(targetRect.x + targetRect.w / 2 - 172, window.innerWidth - 356));
    return below
      ? { top: targetRect.y + targetRect.h + 12, left, above: false, centered: false }
      : { top: Math.max(12, targetRect.y - 12), left, above: true, centered: false };
  }, [targetRect]);

  if (!open || !step) return null;

  const centered = !targetRect;

  return (
    <div className='fixed inset-0 z-[60]' role='dialog' aria-modal='true' aria-label='Site tour'>
      {/* dim: the spotlight div carries a 9999px box-shadow; this backing
          div only guarantees uniform coverage on tiny viewports */}
      <div className='absolute inset-0 bg-black/55' onClick={next} />

      <motion.div
        className='absolute overflow-visible rounded-xl'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={centered ? undefined : next}
        style={{
          left: targetRect ? targetRect.x - 6 : 0,
          top: targetRect ? targetRect.y - 6 : 0,
          width: targetRect ? targetRect.w + 12 : 1,
          height: targetRect ? targetRect.h + 12 : 1,
          boxShadow: '0 0 0 100vmax rgba(0,0,0,0.55)',
          pointerEvents: centered ? 'none' : 'auto',
          transition: reduce ? 'none' : 'left .3s cubic-bezier(.22,1,.36,1), top .3s cubic-bezier(.22,1,.36,1), width .3s cubic-bezier(.22,1,.36,1), height .3s cubic-bezier(.22,1,.36,1)',
        }}
      />
      <AnimatePresence>
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: tip.above ? 10 : -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', duration: 0.32, bounce: 0.22 }}
          className='fixed z-[70] w-[344px] max-w-[calc(100vw-24px)] rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] p-4 shadow-2xl shadow-black/40'
          style={{
            top: tip.above && !tip.centered ? undefined : tip.top,
            bottom: tip.above && !tip.centered ? Math.max(12, window.innerHeight - targetRect!.y + 12) : undefined,
            left: tip.left,
          }}
        >
          <div className='flex items-center justify-between gap-3'>
            <span className='inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--terminal-green)]'>
              <Compass className='h-3 w-3' />
              tour {String(idx + 1).padStart(2, '0')}/{String(steps.length).padStart(2, '0')}
            </span>
            <button
              type='button'
              onClick={onClose}
              className='rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text)]'
              aria-label='Close the tour'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          </div>
          <h3 className='mt-2 font-display text-base font-semibold text-[var(--text-heading)]'>{step.title}</h3>
          <p className='mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]'>{step.body}</p>
          <div className='mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3'>
            <div className='flex gap-1.5'>
              {steps.map((_, i) => (
                <button
                  key={i}
                  type='button'
                  aria-label={`Go to tip ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === idx ? 'w-4 bg-[var(--terminal-green)]' : 'w-1.5 bg-[var(--border)] hover:bg-[var(--text-muted)]',
                  )}
                />
              ))}
            </div>
            <div className='flex gap-2'>
              {idx > 0 && (
                <button
                  type='button'
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  className='inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)]'
                >
                  <ChevronLeft className='h-3.5 w-3.5' />
                  back
                </button>
              )}
              <button
                type='button'
                onClick={next}
                className='inline-flex items-center gap-1 rounded-lg bg-[var(--terminal-green)] px-3 py-1.5 font-mono text-xs font-semibold text-black hover:opacity-90'
              >
                {idx === steps.length - 1 ? 'done' : 'next'}
                <ChevronRight className='h-3.5 w-3.5' />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export { OnboardingTour };
