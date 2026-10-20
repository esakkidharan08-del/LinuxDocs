import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, FileText, History, Clock, Trash2, ExternalLink, GraduationCap, Layers, Target, Flame, Trophy, ArrowRight, Star, Award, Shield, BookOpen, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCommand, getPathForCommand } from '../data/commands';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { LEARNING_PATHS } from './LearningPage';
import { TOTAL_MISSIONS } from './PracticeTerminalPage';
import { readStreak } from '../lib/streak';

type ProgressEntry = { completed?: boolean; bestScore?: number; bestTotal?: number; lessons?: string[] };

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* corrupted or missing - use fallback */
  }
  return fallback;
}

type Badge = { id: string; label: string; hint: string; earned: boolean; progress: number; icon: LucideIcon };

/** Badges are derived from saved progress across every feature - nothing to track. */
const AchievementsPanel = () => {
  const badges = useMemo<Badge[]>(() => {
    const progress = readJson<Record<string, ProgressEntry>>('linuxdocs.learning-progress-v3', {});
    const terminal = readJson<{ solved?: string[] }>('linuxdocs.practice-terminal', {});
    const flash = readJson<{ completes?: Record<string, number> }>('linuxdocs.flashcards', {});
    const drill = readJson<{ best?: number }>('linuxdocs.speeddrill', {});
    const streak = readStreak();

    const entries = LEARNING_PATHS.map((path) => progress[path.id]);
    const pathsDone = entries.filter((entry) => entry?.completed).length;
    const stage1Done = LEARNING_PATHS.slice(0, 4).filter((path) => progress[path.id]?.completed).length;
    const hasQuiz = entries.some((entry) => (entry?.bestTotal ?? 0) > 0);
    const quizAce = entries.some((entry) => entry?.bestTotal && (entry.bestScore ?? 0) / entry.bestTotal >= 0.9);
    const missions = Array.isArray(terminal.solved) ? terminal.solved.length : 0;
    const deckSessions = Object.values(flash.completes ?? {}).reduce((sum, count) => sum + (count || 0), 0);
    const drillBest = drill.best ?? 0;
    const streakBest = streak.best;

    return [
      { id: 'first-quiz', label: 'Pop quiz', hint: 'Finish your first quiz', earned: hasQuiz, progress: hasQuiz ? 1 : 0, icon: GraduationCap },
      { id: 'quiz-ace', label: 'Quiz ace', hint: 'Score 90%+ on any quiz', earned: quizAce, progress: quizAce ? 1 : 0, icon: Star },
      { id: 'stage-1', label: 'Stage 1 cleared', hint: 'All four foundation paths', earned: stage1Done === 4, progress: stage1Done / 4, icon: Award },
      { id: 'curriculum', label: 'Full curriculum', hint: 'All eight paths complete', earned: pathsDone === LEARNING_PATHS.length, progress: pathsDone / LEARNING_PATHS.length, icon: Trophy },
      { id: 'missions-5', label: 'Field operator', hint: 'Solve 5 terminal missions', earned: missions >= 5, progress: missions / 5, icon: Target },
      { id: 'missions-13', label: 'Box mastered', hint: 'Solve all 13 missions', earned: missions >= 13, progress: missions / 13, icon: Shield },
      { id: 'deck-1', label: 'Deck runner', hint: 'Finish a flashcard session', earned: deckSessions >= 1, progress: Math.min(1, deckSessions), icon: BookOpen },
      { id: 'deck-5', label: 'Deck marathon', hint: 'Finish five sessions', earned: deckSessions >= 5, progress: deckSessions / 5, icon: Layers },
      { id: 'drill-15', label: 'Quick reflexes', hint: 'Score 15+ in a speed drill', earned: drillBest >= 15, progress: drillBest / 15, icon: Zap },
      { id: 'drill-30', label: 'Drill sergeant', hint: 'Score 30+ in a speed drill', earned: drillBest >= 30, progress: drillBest / 30, icon: Award },
      { id: 'streak-5', label: 'On a roll', hint: 'Reach a 5-day streak', earned: streakBest >= 5, progress: streakBest / 5, icon: Flame },
      { id: 'streak-30', label: 'Habit locked in', hint: 'Reach a 30-day streak', earned: streakBest >= 30, progress: streakBest / 30, icon: Flame },
    ];
  }, []);

  const earnedCount = badges.filter((badge) => badge.earned).length;

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-[var(--text-heading)]">Achievements</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {earnedCount}/{badges.length} unlocked
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={`rounded-xl border p-3 text-center transition-colors ${
              badge.earned ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-[var(--border)] bg-[var(--bg-surface-elevated)]'
            }`}
          >
            <badge.icon
              className={`mx-auto h-6 w-6 ${badge.earned ? 'text-emerald-400' : 'text-[var(--text-muted)] opacity-50'}`}
            />
            <p className={`mt-1.5 text-xs font-semibold ${badge.earned ? 'text-[var(--text-heading)]' : 'text-[var(--text-muted)]'}`}>
              {badge.label}
            </p>
            {!badge.earned && (
              <>
                <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-muted)]">{badge.hint}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className="h-full rounded-full bg-[var(--terminal-green)] transition-all"
                    style={{ width: `${Math.round(Math.min(1, Math.max(0, badge.progress)) * 100)}%` }}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Aggregate numbers from Learn, the practice terminal and the streak log. */
const LearningSummary = () => {  const stats = useMemo(() => {
    const progress = readJson<Record<string, ProgressEntry>>('linuxdocs.learning-progress-v3', {});
    const pathsDone = LEARNING_PATHS.filter((path) => progress[path.id]?.completed).length;
    const lessonsRead = LEARNING_PATHS.reduce((n, path) => {
      const lessons = progress[path.id]?.lessons;
      return n + (lessons?.length ?? 0);
    }, 0);
    const totalLessons = LEARNING_PATHS.reduce((n, path) => n + path.lessons.length, 0);
    const quizPaths = LEARNING_PATHS.filter((path) => (progress[path.id]?.bestTotal ?? 0) > 0);
    const quizAvg = quizPaths.length
      ? Math.round(
          quizPaths.reduce((sum, path) => {
            const entry = progress[path.id];
            return entry && entry.bestTotal ? sum + ((entry.bestScore ?? 0) / entry.bestTotal) * 100 : sum;
          }, 0) / quizPaths.length,
        )
      : null;
    const terminal = readJson<{ solved?: string[] }>('linuxdocs.practice-terminal', {});
    const missionsSolved = Array.isArray(terminal.solved) ? terminal.solved.length : 0;
    const streak = readStreak();
    return {
      pathsDone,
      totalPaths: LEARNING_PATHS.length,
      lessonsRead,
      totalLessons,
      quizAvg,
      quizTaken: quizPaths.length,
      missionsSolved,
      streak,
    };
  }, []);

  const cards = [
    {
      icon: GraduationCap,
      label: 'Paths complete',
      value: `${stats.pathsDone}/${stats.totalPaths}`,
      bar: stats.pathsDone / stats.totalPaths,
      sub: 'learning paths',
    },
    {
      icon: FileText,
      label: 'Lessons read',
      value: `${stats.lessonsRead}/${stats.totalLessons}`,
      bar: stats.totalLessons ? stats.lessonsRead / stats.totalLessons : 0,
      sub: 'across every path',
    },
    {
      icon: Trophy,
      label: 'Quiz average',
      value: stats.quizAvg === null ? '—' : `${stats.quizAvg}%`,
      bar: stats.quizAvg ? stats.quizAvg / 100 : 0,
      sub: `${stats.quizTaken} quizzes taken`,
    },
    {
      icon: Target,
      label: 'Missions solved',
      value: `${stats.missionsSolved}/${TOTAL_MISSIONS}`,
      bar: stats.missionsSolved / TOTAL_MISSIONS,
      sub: 'practice terminal',
    },
    {
      icon: Flame,
      label: 'Learning streak',
      value: stats.streak.current > 0 ? `${stats.streak.current}d` : '—',
      bar: Math.min(1, stats.streak.current / 14),
      sub: stats.streak.best > 0 ? `best ${stats.streak.best}d` : 'visit daily to build it',
    },
  ];

  return (
    <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-[var(--text-heading)]">Your learning progress</h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">saved on this device</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] p-4">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
              <card.icon className="h-3.5 w-3.5 text-[var(--terminal-green)]" /> {card.label}
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold text-[var(--text-heading)]">{card.value}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg)]">
              <div className="h-full rounded-full bg-[var(--terminal-green)] transition-all" style={{ width: `${Math.round(Math.min(1, Math.max(0, card.bar)) * 100)}%` }} />
            </div>
            <p className="mt-1.5 truncate text-xs text-[var(--text-muted)]">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link to="/learn" className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--terminal-green)] hover:underline">
          <GraduationCap className="h-4 w-4" /> Continue paths <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to="/flashcards" className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--terminal-green)] hover:underline">
          <Layers className="h-4 w-4" /> Flashcards <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to="/practice-terminal" className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--terminal-green)] hover:underline">
          <Target className="h-4 w-4" /> Practice terminal <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link to="/speed-drill" className="inline-flex items-center gap-1.5 font-mono text-sm text-[var(--terminal-green)] hover:underline">
          <Zap className="h-4 w-4" /> Speed drill <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
};

const DashboardContent = () => {
  const { bookmarks, notes, history, refreshUserData, deleteNote, toggleBookmark } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'notes' | 'history'>('bookmarks');
  const [confirmingNote, setConfirmingNote] = useState<string | null>(null);
  useEffect(() => {
    refreshUserData();
  }, [refreshUserData]);

  const bookmarkedCommands = Array.from(bookmarks).map((slug) => getCommand(slug)).filter(Boolean);
  const notedCommands = Array.from(notes.entries()).map(([slug, text]) => ({ slug, text, command: getCommand(slug) })).filter((n) => n.command);
  const historyCommands = history.map((slug) => getCommand(slug)).filter(Boolean);

  const handleRemoveBookmark = async (slug: string) => {
    await toggleBookmark(slug);
  };

  const handleDeleteNote = async (slug: string) => {
    await deleteNote(slug);
    setConfirmingNote(null);
  };

  const renderEmptyState = (icon: React.ReactNode, title: string, description: string, action?: React.ReactNode) => (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]">
        {icon}
      </div>
      <h3 className="mb-1 font-display text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mb-4 text-sm text-[var(--text-muted)]">{description}</p>
      {action}
    </div>
  );

  return (
    <div className="bg-[var(--bg)]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--text-heading)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Bookmarks, notes and recent views — plus everything you learned so far</p>
        </div>

        <LearningSummary />
        <AchievementsPanel />

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="border-b border-[var(--border)] bg-[var(--bg-surface-elevated)] px-3 py-3">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {[
                { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, count: bookmarkedCommands.length },
                { id: 'notes', label: 'Notes', icon: FileText, count: notedCommands.length },
                { id: 'history', label: 'History', icon: History, count: historyCommands.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 font-mono text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[var(--bg-surface)] text-[var(--text-heading)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  <span className="rounded bg-[var(--bg)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'bookmarks' && (
              <div className="space-y-3">
                {bookmarkedCommands.length === 0 ? (
                  renderEmptyState(
                    <Bookmark className="w-6 h-6" />,
                    'No bookmarks yet',
                    'Star commands on their detail pages to save them here',
                    <Link to="/" className="inline-flex items-center gap-2 text-[var(--terminal-green)] hover:underline font-mono text-sm">
                      <ExternalLink className="w-4 h-4" />
                      Browse Commands
                    </Link>
                  )
                ) : (
                  bookmarkedCommands.map((cmd) => (
                    <div key={cmd!.slug} className="flex items-center justify-between p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-lg hover:border-[var(--border-subtle)] transition-colors group">
                      <Link to={getPathForCommand(cmd!)} className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <code className="font-mono text-[var(--terminal-green)] bg-[var(--terminal-green-bg)] px-2 py-1 rounded text-sm">{cmd!.name}</code>
                          <span className="text-[var(--text-muted)] text-sm hidden sm:block truncate">{cmd!.summary}</span>
                        </div>
                      </Link>
                      <button
                        onClick={() => handleRemoveBookmark(cmd!.slug)}
                        className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Remove bookmark"
                      >
                        <Bookmark className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="space-y-3">
                {notedCommands.length === 0 ? (
                  renderEmptyState(
                    <FileText className="w-6 h-6" />,
                    'No notes yet',
                    'Add notes on command detail pages to see them here'
                  )
                ) : (
                  notedCommands.map(({ slug, text, command }) => (
                    <div key={slug} className="bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-lg overflow-hidden">
                      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                        <Link to={getPathForCommand(command!)} className="flex items-center gap-3">
                          <code className="font-mono text-[var(--terminal-green)] bg-[var(--terminal-green-bg)] px-2 py-1 rounded text-sm">{command!.name}</code>
                        </Link>
                        {confirmingNote === slug ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDeleteNote(slug)}
                              className="rounded-lg bg-[var(--ctf-red-bg)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--ctf-red)] hover:bg-[var(--ctf-red)]/20"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmingNote(null)}
                              className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingNote(slug)}
                            className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--ctf-red-bg)] hover:text-[var(--ctf-red)]"
                            aria-label="Delete note"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                      <div className="p-4">
                        <pre className="font-mono text-sm text-[var(--text)] whitespace-pre-wrap break-words">{text}</pre>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-3">
                {historyCommands.length === 0 ? (
                  renderEmptyState(
                    <History className="w-6 h-6" />,
                    'No history yet',
                    'Recently viewed commands will appear here'
                  )
                ) : (
                  historyCommands.map((cmd, index) => (
                    <div key={cmd!.slug} className="flex items-center justify-between p-4 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-lg hover:border-[var(--border-subtle)] transition-colors group">
                      <Link to={getPathForCommand(cmd!)} className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-[var(--text-muted)] font-mono text-sm w-8 text-right">{index + 1}.</span>
                        <code className="font-mono text-[var(--terminal-green)] bg-[var(--terminal-green-bg)] px-2 py-1 rounded text-sm">{cmd!.name}</code>
                        <span className="text-[var(--text-muted)] text-sm hidden sm:block truncate">{cmd!.summary}</span>
                      </Link>
                      <Clock className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const DashboardPage: React.FC = () => (
  <ProtectedRoute>
    <DashboardContent />
  </ProtectedRoute>
);