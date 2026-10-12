import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, FileText, History, Clock, Trash2, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCommand, getPathForCommand } from '../data/commands';
import { ProtectedRoute } from '../components/ProtectedRoute';

const DashboardContent = () => {
  const { bookmarks, notes, history, refreshUserData, deleteNote, toggleBookmark } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'notes' | 'history'>('bookmarks');

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
    if (confirm('Delete this note?')) {
      await deleteNote(slug);
    }
  };

  const renderEmptyState = (icon: React.ReactNode, title: string, description: string, action?: React.ReactNode) => (
    <div className="text-center py-12">
      <div className="mx-auto mb-4 p-3 rounded-full bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] w-12 h-12 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-mono text-lg font-semibold text-[var(--text)] mb-1">{title}</h3>
      <p className="text-[var(--text-muted)] text-sm mb-4">{description}</p>
      {action}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-mono text-3xl font-bold text-[var(--text-heading)]">Dashboard</h1>
          <p className="text-[var(--text-muted)] mt-1">Manage your bookmarks, notes, and recently viewed commands</p>
        </div>

        <div className="terminal-window bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="terminal-header bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] px-4 py-3">
            <div className="flex gap-1 overflow-x-auto pb-2">
              {[
                { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark, count: bookmarkedCommands.length },
                { id: 'notes', label: 'Notes', icon: FileText, count: notedCommands.length },
                { id: 'history', label: 'History', icon: History, count: historyCommands.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[var(--terminal-green-bg)] text-[var(--terminal-green)] border border-[var(--terminal-green)]/30'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  <span className="px-2 py-0.5 text-xs rounded bg-[var(--bg)] text-[var(--text-muted)]">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="terminal-body p-6">
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
                        <button
                          onClick={() => handleDeleteNote(slug)}
                          className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          aria-label="Delete note"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
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