import React, { useState } from 'react';
import { Users, SlidersHorizontal } from 'lucide-react';
import UserManagementPage from './UserManagementPage';
import SystemSettingsPage from './SystemSettingsPage';

const TABS = [
  { key: 'users', label: 'User Management', icon: Users },
  { key: 'system', label: 'System Settings', icon: SlidersHorizontal },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('users');

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="inline-flex gap-1 p-1.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {activeTab === 'users' ? <UserManagementPage /> : <SystemSettingsPage />}
    </div>
  );
};

export default SettingsPage;
