'use client';

import { Activity, Settings, BarChart3, FileText, Shield } from 'lucide-react';
type TabType = 'playground' | 'analytics' | 'logs' | 'config';

interface SidebarProps {
  activeTab: string;
  // Change this from (tab: string) => void;
  onTabChange: (tab: TabType) => void; 
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const tabs = [
    { id: 'playground', label: 'Live Playground', icon: Activity },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'logs', label: 'Audit Logs', icon: FileText },
    { id: 'config', label: 'Policy Config', icon: Settings },
  ];

  return (
    <aside className="w-64 glass border-r border-slate-700/50 flex flex-col p-6 gap-8">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-white">PromptShield</span>
          <span className="text-xs text-cyan-400">AI Guardrails</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-sm font-medium ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 glow-active'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700/50 pt-4">
        <p className="text-xs text-slate-500">v1.0.0 • Enterprise</p>
      </div>
    </aside>
  );
}
