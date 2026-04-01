import { Shield, CheckCircle, XCircle, Clock, TrendingUp, ChevronRight } from 'lucide-react';

type TabType = 'playground' | 'analytics' | 'logs' | 'config';

interface HeaderProps {
  title: string;
  description?: string;
  activeTab: TabType;
  scanCount: number;
  blockedCount: number;
  passedCount: number;
  avgLatency: number;
}

const tabBreadcrumbs: Record<TabType, string[]> = {
  playground: ['PromptShield', 'Live Playground'],
  analytics: ['PromptShield', 'Analytics'],
  logs: ['PromptShield', 'Audit Logs'],
  config: ['PromptShield', 'Policy Config'],
};

export function Header({ title, description, activeTab, scanCount, blockedCount, passedCount, avgLatency }: HeaderProps) {
  const breadcrumbs = tabBreadcrumbs[activeTab];

  const stats = [
    { label: 'Total Scans', value: scanCount, icon: Shield, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
    { label: 'Blocked', value: blockedCount, icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'Passed', value: passedCount, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
    { label: 'Avg Latency', value: avgLatency > 0 ? `${avgLatency}ms` : '—', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  ];

  return (
    <div className="glass border-b border-slate-700/50 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Breadcrumbs + Title */}
        <div className="flex-1 min-w-0">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 mb-1.5">
            {breadcrumbs.map((crumb, i) => (
              <div key={crumb} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="w-3 h-3 text-slate-600 flex-shrink-0" />}
                <span className={`text-xs ${i === breadcrumbs.length - 1 ? 'text-cyan-400 font-medium' : 'text-slate-500'}`}>
                  {crumb}
                </span>
              </div>
            ))}
          </div>

          {/* Title Row */}
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white truncate">{title}</h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/15 border border-green-500/40">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-green-400 tracking-wide uppercase">Live</span>
            </div>
          </div>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Quick Stats */}
          <div className="hidden lg:flex items-center gap-2">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${stat.bg} transition-all`}
                >
                  <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold font-mono ${stat.color}`}>{stat.value}</span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">{stat.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trend indicator */}
          {scanCount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs text-slate-300 font-mono">
                {Math.round((passedCount / Math.max(scanCount, 1)) * 100)}% pass rate
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}