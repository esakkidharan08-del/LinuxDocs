import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { PageTransition } from '@/components/animate-ui/components/page-transition';
import { ThemeProvider } from './components/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { CatalogProvider } from './context/CatalogContext';
import { ProgressProvider, useProgress } from './context/ProgressContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { OnboardingTour, START_TOUR_EVENT, isTourDone, markTourDone } from './components/OnboardingTour';
import { ShortcutsDialog } from './components/ShortcutsDialog';
import { ProtectedRoute } from './components/ProtectedRoute';

/* Route-level code splitting: every page below is loaded on demand, so the
   first paint only carries the shell + the page actually being visited.
   The palette also loads on demand (it pulls the search index + fuse.js),
   mounted only while open. IntroPage stays light (no heavy deps) but loads
   lazily so returning visitors — who skip the intro — never download it. */
const IntroPage = lazy(() => import('./pages/IntroPage').then((m) => ({ default: m.IntroPage })));
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const CategoryPage = lazy(() => import('./pages/CategoryPage').then((m) => ({ default: m.CategoryPage })));
const CommandDetailPage = lazy(() => import('./pages/CommandDetailPage').then((m) => ({ default: m.CommandDetailPage })));
const CTFHomePage = lazy(() => import('./pages/CTFHomePage').then((m) => ({ default: m.CTFHomePage })));
const CTFDomainPage = lazy(() => import('./pages/CTFDomainPage').then((m) => ({ default: m.CTFDomainPage })));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const SignInPage = lazy(() => import('./pages/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('./pages/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ExplainCommandPage = lazy(() => import('./pages/ExplainCommandPage').then((m) => ({ default: m.ExplainCommandPage })));
const PracticeTerminalPage = lazy(() => import('./pages/PracticeTerminalPage').then((m) => ({ default: m.PracticeTerminalPage })));
const LearningPage = lazy(() => import('./pages/LearningPage').then((m) => ({ default: m.LearningPage })));
const FlashcardsPage = lazy(() => import('./pages/FlashcardsPage').then((m) => ({ default: m.FlashcardsPage })));
const SpeedDrillPage = lazy(() => import('./pages/SpeedDrillPage').then((m) => ({ default: m.SpeedDrillPage })));
const CheatSheetsPage = lazy(() => import('./pages/CheatSheetsPage').then((m) => ({ default: m.CheatSheetsPage })));
const ComparePage = lazy(() => import('./pages/ToolsPages').then((m) => ({ default: m.ComparePage })));
const CommandOfDayPage = lazy(() => import('./pages/ToolsPages').then((m) => ({ default: m.CommandOfDayPage })));
const ExportImportPage = lazy(() => import('./pages/ToolsPages').then((m) => ({ default: m.ExportImportPage })));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage').then((m) => ({ default: m.PasswordResetPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));

/** Terminal-flavored placeholder shown while a route chunk loads. */
const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Loading page">
    <span className="font-mono text-sm text-[var(--text-muted)]">
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--terminal-green)] align-middle" />
      loading module<span className="animate-pulse">_</span>
    </span>
  </div>
);

const INTRO_SEEN_KEY = 'linuxdocs_intro_seen';

function introSeen() {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return true; // no sessionStorage → never force the intro
  }
}

function AppShell() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const { recordVisit } = useProgress();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  /* daily streak: one record per app load, and once more when a session
     lands (boot refresh / sign-in) — the provider no-ops signed-out loads */
  useEffect(() => {
    recordVisit();
  }, [user?.id, recordVisit]);

  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    markTourDone(); // closing at any point = seen, never nag again automatically
  }, []);

  // Part 1: the intro plays once per session but ONLY for a signed-in user.
  // A logged-out visitor on '/' is redirected to sign-in before anything
  // renders (the '/' route itself is protected below), so an unauthenticated
  // intro would expose app-shaped content before any round-trip.
  const showIntro =
    !!user && (location.pathname === '/intro' || (location.pathname === '/' && !introSeen()));

  useEffect(() => {
    if (showIntro) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const inField = ['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === '?' && !inField) {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [showIntro]);

  // First-visit tour: starts once per browser ~1.5s after the (already
  // seen) intro would have finished — never over the changing intro — and
  // is always re-openable via the header compass (START_TOUR_EVENT).
  useEffect(() => {
    if (!user || loading || showIntro) return;
    const timer = setTimeout(() => {
      const authPage = location.pathname === '/sign-in' || location.pathname === '/sign-up';
      if (!authPage && !isTourDone()) setTourOpen(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, [user, loading, showIntro, location.pathname]);

  useEffect(() => {
    const openTour = () => setTourOpen(true);
    window.addEventListener(START_TOUR_EVENT, openTour);
    return () => window.removeEventListener(START_TOUR_EVENT, openTour);
  }, []);

  if (showIntro) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
        <div className="noise-overlay" aria-hidden="true" />
        <Suspense fallback={<div className="min-h-screen bg-[var(--bg)]" />}>
          <IntroPage />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)] transition-colors">
      <div className="noise-overlay" aria-hidden="true" />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-[var(--terminal-green)] focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-semibold focus:text-[var(--bg)]"
      >
        Skip to content
      </a>

      <Header
        onOpenSearch={() => setSearchOpen(true)}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="relative flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main id="main" className="min-w-0 flex-1">
          {/* Page transitions (Animate UI view transitions): the shell above
              stays put, the routed content swaps with the selected effect.
              pageKey defaults to the pathname; reduced motion falls back to
              the plain crossfade inside the component. */}
          <PageTransition effect="bands" className="min-h-[60vh]">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
            {/* Public surface (Part 1): auth pages, legal pages, the void 404.
                Everything else demands a session; see ProtectedRoute. */}
            <Route path="/" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
            <Route path="/intro" element={<ProtectedRoute><IntroPage /></ProtectedRoute>} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/explain" element={<ProtectedRoute><ExplainCommandPage /></ProtectedRoute>} />
            <Route path="/practice-terminal" element={<ProtectedRoute><PracticeTerminalPage /></ProtectedRoute>} />
            <Route path="/learn" element={<ProtectedRoute><LearningPage /></ProtectedRoute>} />
            <Route path="/flashcards" element={<ProtectedRoute><FlashcardsPage /></ProtectedRoute>} />
            <Route path="/speed-drill" element={<ProtectedRoute><SpeedDrillPage /></ProtectedRoute>} />
            <Route path="/cheat-sheets" element={<ProtectedRoute><CheatSheetsPage /></ProtectedRoute>} />
            <Route path="/compare" element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
            <Route path="/command-of-the-day" element={<ProtectedRoute><CommandOfDayPage /></ProtectedRoute>} />
            <Route path="/export-import" element={<ProtectedRoute><ExportImportPage /></ProtectedRoute>} />
            <Route path="/password-reset" element={<PasswordResetPage />} />
            <Route path="/privacy" element={<LegalPage />} />
            <Route path="/terms" element={<LegalPage />} />
            <Route path="/linux/:categoryId" element={<ProtectedRoute><CategoryPage /></ProtectedRoute>} />
            <Route path="/linux/:categoryId/:slug" element={<ProtectedRoute><CommandDetailPage /></ProtectedRoute>} />
            <Route path="/ctf" element={<ProtectedRoute><CTFHomePage /></ProtectedRoute>} />
            <Route path="/ctf/:domainId" element={<ProtectedRoute><CTFDomainPage /></ProtectedRoute>} />
            <Route path="/ctf/:domainId/:slug" element={<ProtectedRoute><CommandDetailPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </Suspense>
          </PageTransition>
          <Footer />
        </main>
      </div>

      {searchOpen && (
        <Suspense fallback={null}>
          <CommandPalette isOpen onClose={() => setSearchOpen(false)} />
        </Suspense>
      )}
      <ShortcutsDialog open={shortcutsOpen} onClose={closeShortcuts} />
      <OnboardingTour open={tourOpen} onClose={closeTour} />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Catalog data (index + per-slug docs) rides on the auth session:
            loaded after sign-in, rebuilt on account switch, dropped on logout. */}
        <CatalogProvider>
          {/* Synced learning progress (Part 2): per-user hydration from
              /api/user/progress + the deterministic offline merge. */}
          <ProgressProvider>
            <BrowserRouter>
              <AppShell />
            </BrowserRouter>
          </ProgressProvider>
        </CatalogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;