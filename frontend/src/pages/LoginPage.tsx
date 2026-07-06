import React, { useEffect, useState, useRef } from 'react';
import { Lock, User as UserIcon, ArrowRight, ChevronDown, X } from 'lucide-react';
import type { User as SpectoUser } from '../hooks/useAuth';
import { getApiUrl } from '../config/api';
import bgImage from '../assets/specto-login-bg.jpg';
import spectoLogo from '../assets/specto-logo.png';

interface LoginPageProps {
  auth: {
    user: SpectoUser | null;
    login: (user: SpectoUser, remember: boolean) => void;
    logout: () => Promise<void>;
  };
}

interface SavedAccount {
  username: string;  // ✅ hanya username, tanpa password
}

const LOCAL_KEY = 'specto-accounts';

const LoginPage: React.FC<LoginPageProps> = ({ auth }) => {
  const { login } = auth;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [showAccountsDropdown, setShowAccountsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load saved accounts
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const list = JSON.parse(raw) as SavedAccount[];
      if (Array.isArray(list)) {
        setSavedAccounts(list);
      }
    } catch {
      window.localStorage.removeItem(LOCAL_KEY);
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowAccountsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

const handleSelectAccount = (acc: SavedAccount) => {
  setUsername(acc.username);
  setPassword(''); // ✅ password dikosongkan, user harus isi manual
  setShowAccountsDropdown(false);
};

  const removeSavedAccount = (e: React.MouseEvent, targetUsername: string) => {
    e.stopPropagation(); // Prevent triggering selection
    const updated = savedAccounts.filter(acc => acc.username !== targetUsername);
    setSavedAccounts(updated);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
    if (updated.length === 0) setShowAccountsDropdown(false);
  };

const saveAccountIfNeeded = (u: string, _p: string) => {
  if (!remember) return;
  const others = savedAccounts.filter((a) => a.username !== u);
  const updated = [{ username: u }, ...others]; // ✅ hanya username
  if (updated.length > 5) updated.pop();
  setSavedAccounts(updated);
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Login gagal');
      }

      const data = await res.json();

      if (!data || !data.user) {
        throw new Error('Response login tidak berisi user');
      }

      saveAccountIfNeeded(username, '');
      login(data.user as SpectoUser, true);
    } catch (err) {
      console.error('Login error:', err);
      setError('Login gagal. Periksa koneksi atau kredensial Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    const to = 'irfan-fauzi@seikou-sc.com';
    const subject = encodeURIComponent('Reset Password Specto App');
    const body = encodeURIComponent(
      `Halo,\n\nSaya ingin mengajukan permintaan reset password untuk akun Specto App.\n\nUsername: ${username || '<isi username di sini>'}\n\nTerima kasih.\n`
    );

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-specto-bg-dark bg-cover bg-center relative"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-specto-surface-light/95 dark:bg-specto-surface-dark/95 rounded-3xl shadow-2xl border border-specto-border-light/70 dark:border-slate-800 px-8 py-10 md:px-10 md:py-12">
          {/* Logo Specto */}
          <div className="flex justify-center mb-6">
            <div className="h-32 w-32 rounded-[30px] bg-specto-surface-light dark:bg-specto-surface-dark flex items-center justify-center shadow-2xl shadow-specto-blue/50 border border-specto-border-light/80 dark:border-slate-700">
              <img
                src={spectoLogo}
                alt="Specto logo"
                className="h-24 w-24 object-contain"
              />
            </div>
          </div>

          <h1 className="text-2xl font-black text-center text-slate-900 dark:text-slate-50">
            SPECTO APP
          </h1>
          <p className="mt-1 text-xs text-center text-slate-500 dark:text-slate-400">
            Server Room Monitoring
          </p>
          <p className="mt-5 mb-4 text-[11px] text-center tracking-[0.15em] uppercase text-slate-400">
            Sign in to dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username + Custom Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Username
              </label>
              <div className="flex items-center rounded-xl border border-specto-border-light bg-specto-surface-light dark:bg-specto-surface-soft dark:border-slate-700 px-3 relative z-20">
                <UserIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (savedAccounts.length > 0) setShowAccountsDropdown(true);
                  }}
                  onFocus={() => {
                    if (savedAccounts.length > 0) setShowAccountsDropdown(true);
                  }}
                  placeholder="Enter username"
                  className="w-full bg-transparent border-0 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 py-2.5 pl-2"
                  autoComplete="off" // Disable browser native autocomplete to use ours
                  required
                />
                {savedAccounts.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => setShowAccountsDropdown(!showAccountsDropdown)}
                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 transition"
                  >
                    <ChevronDown size={14} />
                  </button>
                )}
              </div>

              {/* Enhanced Custom Dropdown */}
              {showAccountsDropdown && savedAccounts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="text-[10px] uppercase font-bold text-slate-400 px-3 py-2 bg-slate-50 dark:bg-slate-900/50">
                    Saved Accounts
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {savedAccounts.map((acc, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-700/50 cursor-pointer group transition-colors"
                        onClick={() => handleSelectAccount(acc)}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                            {acc.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                              {acc.username}
                            </span>
                            <span className="text-[10px] text-slate-400">●●●●●●●●</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => removeSavedAccount(e, acc.username)}
                          className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Remove account"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="flex items-center rounded-xl border border-specto-border-light bg-specto-surface-light dark:bg-specto-surface-soft dark:border-slate-700 px-3">
                <Lock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-0 outline-none text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 py-2.5 pl-2"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs mt-1">
              <label className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 checked:bg-specto-blue checked:border-specto-blue transition-all"
                  />
                  <svg
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-specto-blue hover:text-sky-500 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex gap-2 items-start animate-in slide-in-from-top-1">
                <div className="mt-0.5 text-red-500 flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-4 w-full inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-specto-blue to-sky-500 text-white text-sm font-bold py-3 shadow-lg shadow-specto-blue/30 hover:shadow-specto-blue/50 hover:from-sky-500 hover:to-specto-blue disabled:opacity-70 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 border-t border-specto-border-light dark:border-slate-800 pt-6">
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-medium">
              © 2025 Specto System · Developed by Irfan Fauzi
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;