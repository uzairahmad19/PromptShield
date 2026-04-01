import { Activity, Settings, BarChart3, FileText, Shield, Cpu, Wifi, AlertOctagon } from 'lucide-react';

type TabType = 'playground' | 'analytics' | 'logs' | 'config';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  scanCount: number;
  blockedCount: number;
}

const tabs = [
  { id: 'playground' as TabType, label: 'Live Playground', icon: Activity, description: 'Test & analyze prompts' },
  { id: 'analytics' as TabType, label: 'Analytics', icon: BarChart3, description: 'Performance metrics' },
  { id: 'logs' as TabType, label: 'Audit Logs', icon: FileText, description: 'Security event history' },
  { id: 'config' as TabType, label: 'Policy Config', icon: Settings, description: 'Manage security rules' },
];

export function Sidebar({ activeTab, onTabChange, scanCount, blockedCount }: SidebarProps) {
  const blockRate = scanCount > 0 ? Math.round((blockedCount / scanCount) * 100) : 0;

  return (
    <aside className="relative glass border-r border-slate-700/50 flex flex-col transition-all duration-300 w-64">

      {/* Logo Area */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700/30">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-slate-900 animate-pulse" />
        </div>
        <div>
          <div className="font-bold text-sm text-white tracking-tight">PromptShield</div>
          <div className="text-[10px] text-cyan-400 font-medium tracking-widest uppercase">AI Guardrails</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1 p-3">
        <div className="px-2 py-1.5 mb-1">
          <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">Navigation</span>
        </div>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`group relative flex items-center gap-3 rounded-lg transition-all duration-200 px-3 py-2.5 ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 glow-active'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
              )}
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs font-medium">{tab.label}</span>
                {!isActive && (
                  <span className="text-[10px] text-slate-600 group-hover:text-slate-500 truncate">{tab.description}</span>
                )}
              </div>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.9)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* System Stats */}
      <div className="p-3 space-y-3 border-t border-slate-700/30">
        <div className="px-1">
          <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase">System Status</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/60">
            <div className="flex items-center gap-2">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px] text-slate-400">Total Scans</span>
            </div>
            <span className="text-[11px] font-semibold text-white font-mono">{scanCount}</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/60">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-3 h-3 text-red-400" />
              <span className="text-[11px] text-slate-400">Blocked</span>
            </div>
            <span className="text-[11px] font-semibold text-red-400 font-mono">{blockedCount}</span>
          </div>
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800/60">
            <div className="flex items-center gap-2">
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-[11px] text-slate-400">Block Rate</span>
            </div>
            <span className="text-[11px] font-semibold text-green-400 font-mono">{blockRate}%</span>
          </div>
        </div>
        <div className="px-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-slate-600">v1.0.0 • Enterprise</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400">Online</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}