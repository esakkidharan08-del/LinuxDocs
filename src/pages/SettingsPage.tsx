import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProtectedRoute } from '../components/ProtectedRoute';

const SettingsContent: React.FC = () => {
  const { user, changePassword, deleteAccount } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  const validatePassword = () => {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Current password is required';
    if (!newPassword || newPassword.length < 10) errors.newPassword = 'New password must be at least 10 characters';
    else if (!/[A-Z]/.test(newPassword)) errors.newPassword = 'Must contain an uppercase letter';
    else if (!/[a-z]/.test(newPassword)) errors.newPassword = 'Must contain a lowercase letter';
    else if (!/\d/.test(newPassword)) errors.newPassword = 'Must contain a number';
    else if (!/[^A-Za-z0-9]/.test(newPassword)) errors.newPassword = 'Must contain a special character';
    if (newPassword !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setPwdErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setPwdLoading(true);
    setPwdErrors({});
    const result = await changePassword({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword });
    setPwdLoading(false);

    if (result.errors) {
      setPwdErrors(result.errors);
    } else {
      setPwdSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdSuccess(false), 3000);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirm !== user?.username) {
      setDeleteErrors({ confirm: 'Type your username to confirm' });
      return;
    }
    setDeleteErrors({});
    setDeleteLoading(true);
    const result = await deleteAccount(deleteConfirm);
    setDeleteLoading(false);
    if (result.errors) {
      setDeleteErrors(result.errors);
    }
  };

  const inputClass = 'w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--terminal-green)] focus:ring-1 focus:ring-[var(--terminal-green)] font-mono text-sm transition-colors';

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="font-mono text-3xl font-bold text-[var(--text-heading)]">Settings</h1>
          <p className="text-[var(--text-muted)] mt-1">Manage your account and preferences</p>
        </div>

        <div className="space-y-6">
          <div className="terminal-window bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="terminal-header bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-[var(--terminal-green)]" />
                <span className="font-mono text-[var(--text-heading)]">Account Info</span>
              </div>
            </div>
            <div className="terminal-body p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] font-mono mb-1">Username</label>
                  <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-mono text-[var(--text)]">{user?.username}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] font-mono mb-1">Email</label>
                  <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-mono text-[var(--text)]">{user?.email}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-muted)] font-mono mb-1">Member Since</label>
                  <div className="px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-mono text-[var(--text)]">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="terminal-window bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="terminal-header bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-[var(--terminal-green)]" />
                <span className="font-mono text-[var(--text-heading)]">Change Password</span>
              </div>
            </div>
            <div className="terminal-body p-6">
              {pwdSuccess && (
                <div className="mb-6 p-3 bg-[var(--terminal-green-bg)] border border-[var(--terminal-green)]/30 rounded-lg flex items-center gap-2 text-[var(--terminal-green)] text-sm font-mono">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Password updated successfully</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      id="currentPassword"
                      type={showCurrent ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={`${inputClass} pl-10 pr-12 ${pwdErrors.currentPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="••••••••"
                      disabled={pwdLoading}
                      aria-invalid={pwdErrors.currentPassword ? 'true' : 'false'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {pwdErrors.currentPassword && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                      <AlertCircle className="w-3 h-3" />
                      {pwdErrors.currentPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      id="newPassword"
                      type={showNew ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`${inputClass} pl-10 pr-12 ${pwdErrors.newPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="••••••••"
                      disabled={pwdLoading}
                      aria-invalid={pwdErrors.newPassword ? 'true' : 'false'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {pwdErrors.newPassword && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                      <AlertCircle className="w-3 h-3" />
                      {pwdErrors.newPassword}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
                    <input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputClass} pl-10 pr-12 ${pwdErrors.confirmPassword ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="••••••••"
                      disabled={pwdLoading}
                      aria-invalid={pwdErrors.confirmPassword ? 'true' : 'false'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {pwdErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                      <AlertCircle className="w-3 h-3" />
                      {pwdErrors.confirmPassword}
                    </p>
                  )}
                </div>

                {pwdErrors.general && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm font-mono flex items-center gap-2" role="alert">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {pwdErrors.general}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-full py-3 px-4 bg-[var(--terminal-green)] text-[var(--bg)] font-mono font-semibold rounded-lg hover:bg-[var(--terminal-green-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--terminal-green)] focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {pwdLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span>Updating...</span>
                    </>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="terminal-window bg-[var(--bg-surface)] border border-red-500/30 rounded-xl overflow-hidden">
            <div className="terminal-header bg-red-500/10 border-b border-red-500/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-500" />
                <span className="font-mono text-red-500">Danger Zone</span>
              </div>
            </div>
            <div className="terminal-body p-6">
              <div className="mb-4">
                <h3 className="font-mono text-lg font-semibold text-[var(--text)] mb-1">Delete Account</h3>
                <p className="text-[var(--text-muted)] text-sm">Permanently delete your account and all associated data (bookmarks, notes, history). This action cannot be undone.</p>
              </div>

              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div>
                  <label htmlFor="deleteConfirm" className="block text-sm font-medium text-[var(--text)] mb-1 font-mono">
                    Type your username to confirm
                  </label>
                  <input
                    id="deleteConfirm"
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteErrors({}); }}
                    className={`${inputClass} ${deleteErrors.confirm ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                    placeholder={user?.username || 'username'}
                    disabled={deleteLoading}
                    aria-invalid={deleteErrors.confirm ? 'true' : 'false'}
                  />
                  {deleteErrors.confirm && (
                    <p className="mt-1 text-sm text-red-500 flex items-center gap-1 font-mono" role="alert">
                      <AlertCircle className="w-3 h-3" />
                      {deleteErrors.confirm}
                    </p>
                  )}
                </div>

                {deleteErrors.general && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm font-mono flex items-center gap-2" role="alert">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {deleteErrors.general}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="w-full py-3 px-4 bg-red-500/20 text-red-500 border border-red-500/30 font-mono font-semibold rounded-lg hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[var(--bg)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    'Delete Account Permanently'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SettingsPage: React.FC = () => (
  <ProtectedRoute>
    <SettingsContent />
  </ProtectedRoute>
);