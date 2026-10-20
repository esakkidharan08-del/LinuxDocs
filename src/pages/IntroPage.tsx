import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { IntroScene } from '../components/IntroScene';
import { KineticTextLoader } from '../components/ui/KineticTextLoader';
import { COMMANDS } from '../data/commands';
import { useAuth } from '../context/AuthContext';

const INTRO_SEEN_KEY = 'linuxdocs_intro_seen';

type Stage = 'boot' | 'domain' | 'connecting' | 'granted' | 'leave';

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Types one line at a time, at a snappy cyberpunk pace.
 * `instant` flushes every line immediately.
 */
function useTypewriter(lines: string[], instant: boolean) {
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const done = lineIdx >= lines.length;

  useEffect(() => {
    if (done) return;
    const line = lines[lineIdx];
    if (instant) {
      setCharIdx(line.length);
      const timer = window.setTimeout(() => {
        setCharIdx(0);
        setLineIdx((i) => i + 1);
      }, 60);
      return () => window.clearTimeout(timer);
    }
    if (charIdx < line.length) {
      const timer = window.setTimeout(
        () => setCharIdx((c) => Math.min(c + 3, line.length)),
        12
      );
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setCharIdx(0);
      setLineIdx((i) => i + 1);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [done, instant, lineIdx, charIdx, lines]);

  const visibleCount = Math.min(lineIdx + 1, lines.length);
  const rendered = Array.from({ length: visibleCount }, (_, i) =>
    i === lineIdx && !done ? lines[i].slice(0, charIdx) : lines[i]
  );
  return { rendered, done };
}

export const IntroPage = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotion();

  const [stage, setStage] = useState<Stage>('boot');
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);

  const counts = useMemo(() => {
    const total = COMMANDS.length;
    const linux = COMMANDS.filter((c) => c.section === 'linux').length;
    return { total, linux, ctf: total - linux };
  }, []);

  const bootLines = useMemo(
    () => [
      'LINUXDOCS://KERNEL 6.6 — establishing uplink',
      'mounting /docs .......................... OK',
      `indexing ${counts.total} command entries ..... OK`,
      'neon channels: MAGENTA ⟷ CYAN .......... OK',
      'uplink stable — system online',
    ],
    [counts.total]
  );

  const { rendered, done: typingDone } = useTypewriter(bootLines, reducedMotion);

  // 3D scene lifecycle
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new IntroScene(canvas, { instant: reducedMotion });
    scene.start();
    const onResize = () => scene.resize();
    const onPointer = (ev: PointerEvent) => {
      scene.setPointer(
        (ev.clientX / window.innerWidth) * 2 - 1,
        (ev.clientY / window.innerHeight) * 2 - 1
      );
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
      scene.stop();
    };
  }, [reducedMotion]);

  // boot → domain once the typewriter finishes
  useEffect(() => {
    if (stage !== 'boot' || !typingDone) return;
    const timer = window.setTimeout(() => setStage('domain'), 420);
    return () => window.clearTimeout(timer);
  }, [stage, typingDone]);

  // domain waits for the user: the INITIATE button advances to connecting.

  // connecting → kinetic loading screen → granted (no automatic handoff to the site)
  useEffect(() => {
    if (stage !== 'connecting') return;
    const duration = reducedMotion ? 200 : 2800;
    const step = 24;
    const totalTicks = Math.max(1, Math.round(duration / step));
    let tick = 0;
    const interval = window.setInterval(() => {
      tick += 1;
      const p = Math.min(1, tick / totalTicks);
      setProgress(p);
      if (p >= 1) {
        window.clearInterval(interval);
        setStage('granted');
      }
    }, step);
    return () => window.clearInterval(interval);
  }, [stage, reducedMotion]);

  // leave → fade out → mark seen → home
  useEffect(() => {
    if (stage !== 'leave') return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(INTRO_SEEN_KEY, '1');
      } catch {
        /* sessionStorage unavailable — let them through anyway */
      }
      navigate('/', { replace: true });
    }, 560);
    return () => window.clearTimeout(timer);
  }, [stage, navigate]);

  const finishEarly = () => {
    if (stage === 'leave') return;
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      /* noop */
    }
    navigate('/', { replace: true });
  };

  // Explicit "ENTER" - sends already-signed-up users home and new visitors to sign-up.
  const enterHome = () => {
    if (stage === 'leave') return;
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      /* noop */
    }
    setLeaving(true);
    const target = !loading && user ? '/' : '/sign-up';
    setTimeout(() => {
      navigate(target, { replace: true });
    }, 560);
  };

  // Esc to skip
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || stage === 'leave') return;
      try {
        sessionStorage.setItem(INTRO_SEEN_KEY, '1');
      } catch {
        /* noop */
      }
      navigate('/', { replace: true });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, navigate]);

  const progressLabel =
    progress < 0.35
      ? 'breaching perimeter firewall'
      : progress < 0.7
        ? 'spoofing identity · decrypting routes'
        : 'establishing secure channel';

  const pct = Math.round(progress * 100);

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#07010d] text-[#eef3ff]">
      {/* 3D cyberpunk scene */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      />

      {/* CRT effects: flicker + scanlines + vignette */}
      <div aria-hidden="true" className="cp-flicker pointer-events-none absolute inset-0 z-20" />
      <div aria-hidden="true" className="cp-scanlines pointer-events-none absolute inset-0 z-20" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20"
        style={{
          background:
            'radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(2,0,8,0.75) 100%)',
        }}
      />

      <div
        className={`relative z-10 flex h-full flex-col transition-opacity duration-500 ${
          leaving ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {/* HUD top bar */}
        <header className="flex items-start justify-between px-5 pt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-[#8b81a6] sm:px-8 sm:pt-6">
          <span className="flex items-center gap-2">
            <span className="text-[#00f0ff]">◆</span>
            <span>
              LinuxDocs<span className="text-[#ff2e97]">://</span>boot
            </span>
          </span>
          <button
            type="button"
            onClick={finishEarly}
            className="cp-glow-border rounded-md border border-[#3a2f5e] px-3 py-1.5 text-[#a89ccb] transition-colors hover:border-[#00f0ff] hover:text-[#00f0ff]"
          >
            [ESC] skip
          </button>
        </header>

        {/* centre stage */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          {/* wordmark */}
          <h1
            aria-hidden="true"
            className="cp-wordmark font-mono text-[clamp(2.6rem,8vw,6.5rem)] font-bold uppercase leading-none tracking-[0.06em]"
          >
            <span className="cp-neon-cyan">Linux</span>
            <span className="cp-neon-magenta">Docs</span>
          </h1>
          <div aria-hidden="true" className="cp-rule mt-7 h-px w-[min(26rem,74vw)]" />

          {stage === 'boot' && (
            <div className="cp-ret mt-10 w-full max-w-md px-3 py-4 text-left">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#ff2e97]">
                boot.log
              </p>
              <ul aria-live="polite" className="space-y-1.5 font-mono text-[13px] leading-relaxed text-[#a8a0c2]">
                {rendered.map((line, i) => {
                  const isActive = i === rendered.length - 1 && !typingDone;
                  return (
                    <li key={i} className="text-left">
                      <span className="mr-2 text-[#00f0ff]/80">›</span>
                      {line}
                      {isActive && (
                        <span className="cp-block ml-1 inline-block h-[13px] w-[8px] bg-[#00f0ff] align-middle" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {stage === 'domain' && (
            <div className="cp-ret mt-10 w-full max-w-lg px-6 py-5">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.35em] text-[#00f0ff]">
                system awaiting target vector
              </p>
              <p className="cp-glow-text font-mono text-[clamp(1.4rem,4vw,2.6rem)] font-bold uppercase tracking-[0.3em] text-[#eef3ff]">
                Enter Domain<span className="cp-block ml-2 inline-block h-[0.9em] w-[0.45em] bg-[#ff2e97] align-baseline" />
              </p>
              <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.25em] text-[#8b81a6]">
                awaiting authorization — press <span className="text-[#00f0ff]">[ initiate ]</span>
                <span className="cp-pulse text-[#ff2e97]"> ▮</span>
              </p>
              <button
                type="button"
                onClick={() => setStage('connecting')}
                className="mt-6 cp-glow-border rounded-md border border-[#3a2f5e] px-5 py-2 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#00f0ff] transition-colors hover:border-[#ff2e97] hover:text-[#ff2e97]"
              >
                initiate →&nbsp;
              </button>
            </div>
          )}

          {stage === 'connecting' && (
            <div className="rise-in mt-12 flex flex-col items-center gap-8">
              {/* Kinetic text loader — themed with the main UI's dark tokens */}
              <div
                style={
                  {
                    '--terminal-green': '#52c79e',
                    '--text-heading': '#faf6ef',
                  } as CSSProperties
                }
              >
                <KineticTextLoader text="Loading" />
              </div>
              <p
                aria-live="polite"
                className="cp-glow-text font-mono text-xs uppercase tracking-[0.3em] text-[#8b81a6]"
              >
                {progressLabel}
              </p>
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]">
                <span className="text-[#8b81a6]">handshake in progress</span>
                <span className="text-[#00f0ff]">{pct}%</span>
              </div>
            </div>
          )}

          {stage === 'granted' && (
            <div className="rise-in cp-ret mt-10 w-full max-w-lg px-6 py-6 text-center">
              <p className="cp-neon-magenta mb-3 font-mono text-[clamp(1.6rem,4.5vw,2.8rem)] font-bold uppercase tracking-[0.25em]">
                ACCESS GRANTED
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#8b81a6]">
                welcome, operator — the reference is yours
              </p>
              <button
                type="button"
                onClick={enterHome}
                className="cp-glow-border mt-7 rounded-md border border-[#ff2e97]/60 px-7 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[#ff2e97] transition-colors hover:border-[#00f0ff] hover:text-[#00f0ff]"
              >
                enter LinuxDocs →
              </button>
            </div>
          )}
        </main>

        {/* HUD bottom ticker */}
        <footer className="px-5 pb-5 font-mono text-[10px] uppercase tracking-[0.28em] text-[#6b6187] sm:px-8">
          <span className="text-[#ff2e97]">sys_id:</span> op-42 ·{' '}
          <span className="text-[#00f0ff]">{counts.total}</span> commands indexed ·{' '}
          {counts.linux} linux · {counts.ctf} ctf · <span className="text-[#00f0ff]">uplink: nominal</span>
        </footer>
      </div>
    </div>
  );
};

export default IntroPage;