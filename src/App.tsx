import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Footer } from './components/Footer';
import { CommandPalette } from './components/CommandPalette';
import { LandingPage } from './pages/LandingPage';
import { CategoryPage } from './pages/CategoryPage';
import { CommandDetailPage } from './pages/CommandDetailPage';
import { CTFHomePage } from './pages/CTFHomePage';
import { CTFDomainPage } from './pages/CTFDomainPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ExplainCommandPage } from './pages/ExplainCommandPage';
import { PracticeTerminalPage } from './pages/PracticeTerminalPage';
import { LearningPage } from './pages/LearningPage';
import { CheatSheetsPage } from './pages/CheatSheetsPage';
import { ComparePage, CommandOfDayPage, ExportImportPage } from './pages/ToolsPages';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); }
      if (event.key === '?' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) { event.preventDefault(); setShortcutsOpen(true); }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)] transition-colors">
            <Header
              onOpenSearch={() => setSearchOpen(true)}
              onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
            />

            <div className="flex-1 flex">
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

              <main className="flex-1 lg:pl-72 min-w-0 transition-all">
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/sign-in" element={<SignInPage />} />
                  <Route path="/sign-up" element={<SignUpPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/explain" element={<ExplainCommandPage />} />
                  <Route path="/practice-terminal" element={<PracticeTerminalPage />} />
                  <Route path="/learn" element={<LearningPage />} />
                  <Route path="/cheat-sheets" element={<CheatSheetsPage />} />
                  <Route path="/compare" element={<ComparePage />} />
                  <Route path="/command-of-the-day" element={<CommandOfDayPage />} />
                  <Route path="/export-import" element={<ExportImportPage />} />
                  <Route path="/linux/:categoryId" element={<CategoryPage />} />
                  <Route path="/linux/:categoryId/:slug" element={<CommandDetailPage />} />
                  <Route path="/ctf" element={<CTFHomePage />} />
                  <Route path="/ctf/:domainId" element={<CTFDomainPage />} />
                  <Route path="/ctf/:domainId/:slug" element={<CommandDetailPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
                <Footer />
              </main>
            </div>

            <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
            {shortcutsOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShortcutsOpen(false)}><div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-mono text-lg font-bold text-[var(--text-heading)]">Keyboard Shortcuts</h2><button onClick={() => setShortcutsOpen(false)} className="text-[var(--text-muted)]">Esc</button></div><div className="mt-5 space-y-3 font-mono text-sm text-[var(--text)]"><p><kbd className="mr-3 rounded border border-[var(--border)] px-2 py-1">Ctrl K</kbd>Open command search</p><p><kbd className="mr-3 rounded border border-[var(--border)] px-2 py-1">?</kbd>Show this guide</p><p><kbd className="mr-3 rounded border border-[var(--border)] px-2 py-1">Ctrl S</kbd>Save a command note</p><p><kbd className="mr-3 rounded border border-[var(--border)] px-2 py-1">Esc</kbd>Close overlays</p></div></div></div>}
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
