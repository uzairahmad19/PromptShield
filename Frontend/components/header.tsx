'use client';

import { Zap } from 'lucide-react';

interface HeaderProps {
  title: string;
  description?: string;
}

export function Header({ title, description }: HeaderProps) {
  return (
    <div className="glass border-b border-slate-700/50 px-8 py-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 border border-green-500/50">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-xs font-semibold text-green-400">Live</span>
            </div>
          </div>
          {description && <p className="text-sm text-slate-400">{description}</p>}
        </div>
      </div>
    </div>
  );
}
