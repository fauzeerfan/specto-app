import React from 'react';
import type { LucideIcon } from 'lucide-react';

type StatusFlag = 'SAFE' | 'DANGER';

interface DataCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  unit?: string;
  status?: StatusFlag;
}

const DataCard: React.FC<DataCardProps> = ({ icon: Icon, title, value, unit, status }) => {
  const isDanger = status === 'DANGER';

  return (
    <div className="relative overflow-hidden bg-specto-surface-light border border-specto-border-light rounded-2xl p-4 shadow-sm dark:bg-specto-surface-soft dark:border-slate-800">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-12 -right-16 h-32 w-32 rounded-full bg-specto-blue-soft/60 blur-3xl dark:bg-specto-blue/18" />
        <div className="absolute -bottom-14 -left-10 h-28 w-28 rounded-full bg-slate-200/70 blur-3xl dark:bg-specto-bg-dark/70" />
      </div>
      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            {title}
          </p>
          <p className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-50">
            {value}
            {unit && <span className="ml-1 text-sm text-slate-500 dark:text-slate-400">{unit}</span>}
          </p>
          {status && (
            <span
              className={`inline-flex mt-3 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                isDanger
                  ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/40'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/40'
              }`}
            >
              {status === 'DANGER' ? 'Danger' : 'Safe'}
            </span>
          )}
        </div>
        <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-slate-100 border border-specto-border-light dark:bg-specto-surface-dark dark:border-slate-700">
          <Icon className="text-specto-blue dark:text-specto-blue-soft" size={26} />
        </div>
      </div>
    </div>
  );
};

export default DataCard;
