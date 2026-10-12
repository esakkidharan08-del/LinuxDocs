import { useState } from 'react';
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

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
