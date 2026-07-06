import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import LoginPage from './pages/LoginPage';
import MonitoringDashboard from './pages/MonitoringDashboard';
import MaintenancePage from './pages/MaintenancePage';
import SettingsPage from './pages/settings/SettingsPage';
import { useAuth } from './hooks/useAuth';
import { Ban } from 'lucide-react';

const App: React.FC = () => {
  const auth = useAuth();

  // Menu aktif default; akan divalidasi/di-override oleh Sidebar sesuai hak akses.
  const [activeMenu, setActiveMenu] = useState<string>('specto-server');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (auth.loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Initializing Specto System...</p>
      </div>
    );
  }

  if (!auth.user) {
    return <LoginPage auth={auth} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      <Sidebar
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeMenu={activeMenu as any}
        setActiveMenu={setActiveMenu}
        user={auth.user}
        onLogout={auth.logout}
      />

      <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth custom-scrollbar">
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto min-h-full">
          <div className="animate-fade-in">
            {activeMenu === 'specto-server' && <MonitoringDashboard key="server" deviceId="specto-server" />}
            {activeMenu === 'maintenance' && <MaintenancePage />}
            {activeMenu === 'settings' && <SettingsPage />}

            {activeMenu === 'empty' && (
              <div className="flex flex-col items-center justify-center h-[70vh] text-center">
                <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-6">
                  <Ban size={64} className="text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">No Access Available</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  Halo <strong>{auth.user.fullName}</strong>,<br />
                  Departemen Anda (<strong>{auth.user.department}</strong>) belum terhubung dengan perangkat Specto manapun saat ini.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
