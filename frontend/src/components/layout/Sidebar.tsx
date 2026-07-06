import React, { useEffect, useMemo, useState } from 'react';
import { Settings, Wrench, LogOut, ChevronLeft, Server, Ban, Sun, Moon } from 'lucide-react';
import spectoLogo from '../../assets/specto-logo.png';
import { useTheme } from '../../context/ThemeContext';

type IconType = React.ComponentType<{ size?: number; className?: string }>;
interface MenuItem { key: string; label: string; icon: IconType; color: string }

interface User {
  id: number | string;
  fullName: string;
  role: string;
  department?: string;
}

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  activeMenu: string;
  setActiveMenu: (v: any) => void;
  user?: User | null;
  onLogout?: () => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, activeMenu, setActiveMenu, user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const allMenus = useMemo<MenuItem[]>(() => [
    { key: 'specto-server', label: 'Specto Server', icon: Server, color: 'from-blue-500 to-cyan-400' },
    { key: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'from-emerald-500 to-green-400' },
    { key: 'settings', label: 'Settings', icon: Settings, color: 'from-purple-500 to-pink-400' },
  ], []);

  // ADMIN melihat semua menu; role User melihat semua menu KECUALI Settings.
  const menus = useMemo(() => {
    if (!user) return [];
    if (user.role === 'ADMIN') return allMenus;
    return allMenus.filter((menu) => menu.key !== 'settings');
  }, [user, allMenus]);

  // Jika menu aktif tidak valid, arahkan ke menu pertama yang boleh diakses.
  useEffect(() => {
    if (!user) return;
    if (menus.length === 0) {
      setActiveMenu('empty');
    } else if (!menus.some((m) => m.key === activeMenu)) {
      setActiveMenu(menus[0].key);
    }
  }, [user, activeMenu, menus, setActiveMenu]);

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const userInitials = user?.fullName ? getInitials(user.fullName) : 'IF';
  const displayName = user?.fullName || 'User';
  const displayRole =
    user?.role === 'ADMIN' ? 'Administrator' : user?.role === 'OPERATOR' ? `${user.department || 'User'}` : 'Guest';

  return (
    <aside
      className={`sticky top-0 h-screen border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-300 flex flex-col z-40 ${
        isOpen ? 'w-72' : 'w-20'
      }`}
    >
      {/* Logo Section */}
      <div
        className={`border-b border-gray-200 dark:border-gray-800 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 flex-shrink-0 flex transition-all duration-300 ${
          isOpen ? 'flex-row items-center justify-between p-6' : 'flex-col items-center justify-center gap-4 py-6 px-2'
        }`}
      >
        <div className={`flex items-center ${isOpen ? 'gap-4' : 'justify-center'}`}>
          <div
            className={`rounded-2xl bg-white p-2 shadow-lg shadow-blue-500/10 ${
              isOpen ? 'w-12 h-12' : 'w-10 h-10'
            } flex items-center justify-center transition-all duration-300`}
          >
            <img src={spectoLogo} alt="Specto logo" className="w-full h-full object-contain" />
          </div>
          {isOpen && (
            <div className="overflow-hidden whitespace-nowrap">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                SPECTO APP
              </h1>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 shadow-sm group ${
            !isOpen ? 'rotate-180' : ''
          }`}
          aria-label={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          <ChevronLeft size={20} className="transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="space-y-2">
          {menus.length > 0 ? (
            menus.map((item) => {
              const Icon = item.icon;
              const active = activeMenu === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveMenu(item.key)}
                  className={`group flex items-center w-full transition-all duration-300 ${
                    isOpen ? 'px-4 py-3.5 rounded-xl' : 'px-2 py-3 rounded-lg justify-center'
                  } ${
                    active
                      ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className={`relative ${isOpen ? 'mr-3' : ''} flex-shrink-0`}>
                    <Icon size={22} className="transition-transform group-hover:scale-110" />
                    {active && <div className="absolute -right-1 -top-1 w-2 h-2 bg-white rounded-full" />}
                  </div>
                  {isOpen && <span className="font-semibold tracking-tight whitespace-nowrap">{item.label}</span>}
                </button>
              );
            })
          ) : (
            <div className={`flex flex-col items-center justify-center h-full text-gray-400 mt-10 ${!isOpen ? 'hidden' : ''}`}>
              <Ban size={48} className="mb-2 opacity-50" />
              <p className="text-xs text-center px-4">
                No access assigned for Department: <br />
                <strong className="text-gray-600 dark:text-gray-300">{user?.department}</strong>
              </p>
            </div>
          )}
        </div>
      </nav>

      {/* Footer User Info */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0 bg-white dark:bg-gray-900">
        {isOpen ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md shadow-blue-500/20 flex-shrink-0">
                <span className="text-white font-bold text-sm">{userInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{displayRole}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-md cursor-help"
              title={`${displayName} (${displayRole})`}
            >
              <span className="text-white font-bold text-xs">{userInitials}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
                aria-label="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Popup */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <LogOut size={32} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm Logout</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Are you sure you want to log out of your account?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    if (onLogout) onLogout();
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
