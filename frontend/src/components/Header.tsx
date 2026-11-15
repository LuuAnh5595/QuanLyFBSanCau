import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  autoPostEnabled?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  autoPostEnabled = true,
  onRefresh,
  isRefreshing = false
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between max-w-lg mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white font-black text-lg shadow-md shadow-emerald-500/20">
            🏸
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight flex items-center gap-2">
              {title}
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                autoPostEnabled 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-slate-200 text-slate-600'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1 ${autoPostEnabled ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                {autoPostEnabled ? 'Auto ON' : 'Auto OFF'}
              </span>
            </h1>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
