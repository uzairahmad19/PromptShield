'use client';

import { Shield, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';

interface VerdictCardProps {
  verdict: 'safe' | 'blocked' | 'sanitized';
  status: 'idle' | 'running' | 'completed';
  layers: any;
}

export function VerdictCard({ verdict, status, layers }: VerdictCardProps) {
  const verdictConfig = {
    safe: {
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/50',
      icon: CheckCircle2,
      label: 'SAFE',
      description: 'Prompt passed all security layers',
    },
    blocked: {
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/50',
      icon: AlertTriangle,
      label: 'BLOCKED',
      description: 'Malicious prompt detected',
    },
    sanitized: {
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/50',
      icon: Zap,
      label: 'SANITIZED',
      description: 'Prompt requires modification',
    },
  };

  const config = verdictConfig[verdict];
  const Icon = config.icon;

  const passedLayers = Object.values(layers).filter(
    (layer: any) => layer.status === 'passed'
  ).length;
  const totalLayers = Object.keys(layers).length;
  const completedLayers = Object.values(layers).filter(
    (layer: any) => layer.status !== 'pending'
  ).length;

  return (
    <div className={`glass rounded-lg border p-6 transition-all duration-300 ${config.borderColor} ${config.bgColor}`}>
      {/* Title */}
      <h3 className="text-sm font-semibold text-white mb-4">Security Verdict</h3>

      {/* Verdict Display */}
      <div className={`p-4 rounded-lg bg-slate-900/50 border ${config.borderColor} mb-6`}>
        <div className="flex items-center gap-3 mb-2">
          <Icon className={`w-6 h-6 ${config.color}`} />
          <div className={`text-2xl font-bold ${config.color}`}>{config.label}</div>
        </div>
        <p className="text-xs text-slate-400">{config.description}</p>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">Pipeline Progress</span>
          <span className="text-xs text-slate-500">
            {completedLayers}/{totalLayers} layers
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-300"
            style={{ width: `${(completedLayers / totalLayers) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-2 pt-4 border-t border-slate-700/50">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Passed Layers</span>
          <span className="font-semibold text-green-300">{passedLayers}/{totalLayers}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Status</span>
          <span className="font-semibold">
            {status === 'idle' ? '—' : status === 'running' ? '⏳ Analyzing' : '✓ Complete'}
          </span>
        </div>
      </div>
    </div>
  );
}
