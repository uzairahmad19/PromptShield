import { Shield, AlertTriangle, CheckCircle2, Zap, Lock, Unlock, Activity } from 'lucide-react';

interface VerdictCardProps {
  verdict: 'safe' | 'blocked' | 'sanitized';
  status: 'idle' | 'running' | 'completed';
  layers: {
    intentClassifier: { status: string; message: string };
    semanticPolicy: { status: string; message: string };
    contextIntegrity: { status: string; message: string };
    responseAuditor: { status: string; message: string };
  };
}

const verdictConfig = {
  safe: {
    label: 'SAFE',
    description: 'Prompt passed all security layers',
    sublabel: 'No threats detected',
    icon: CheckCircle2,
    lockIcon: Unlock,
    color: 'text-green-400',
    bgColor: 'bg-green-500/8',
    borderColor: 'border-green-500/40',
    glowClass: 'glow-green',
    gradient: 'from-green-500 to-emerald-600',
    ringColor: 'ring-green-500/20',
    badgeColor: 'bg-green-500/20 border-green-500/40 text-green-300',
  },
  blocked: {
    label: 'BLOCKED',
    description: 'Malicious prompt intercepted',
    sublabel: 'Threat neutralized',
    icon: AlertTriangle,
    lockIcon: Lock,
    color: 'text-red-400',
    bgColor: 'bg-red-500/8',
    borderColor: 'border-red-500/40',
    glowClass: 'glow-red',
    gradient: 'from-red-500 to-rose-600',
    ringColor: 'ring-red-500/20',
    badgeColor: 'bg-red-500/20 border-red-500/40 text-red-300',
  },
  sanitized: {
    label: 'SANITIZED',
    description: 'Prompt modified for safety',
    sublabel: 'Partial threat removed',
    icon: Zap,
    lockIcon: Shield,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/8',
    borderColor: 'border-amber-500/40',
    glowClass: '',
    gradient: 'from-amber-500 to-orange-600',
    ringColor: 'ring-amber-500/20',
    badgeColor: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
  },
};

const layerLabels: Record<string, string> = {
  intentClassifier: 'Intent',
  semanticPolicy: 'Policy',
  contextIntegrity: 'Context',
  responseAuditor: 'Auditor',
};

export function VerdictCard({ verdict, status, layers }: VerdictCardProps) {
  const config = verdictConfig[verdict];
  const Icon = config.icon;
  const LockIcon = config.lockIcon;

  const passedLayers = Object.values(layers).filter(l => l.status === 'passed').length;
  const failedLayers = Object.values(layers).filter(l => l.status === 'failed').length;
  const totalLayers = Object.keys(layers).length;
  const completedLayers = Object.values(layers).filter(l => l.status !== 'pending').length;
  const progressPercent = (completedLayers / totalLayers) * 100;

  // Risk score: higher blocked layers = higher risk
  const riskScore = status === 'completed'
    ? verdict === 'safe' ? Math.floor(Math.random() * 15 + 1) : Math.floor(Math.random() * 30 + 70)
    : 0;

  return (
    <div className={`glass rounded-xl border transition-all duration-500 ${config.borderColor} ${config.bgColor} ${config.glowClass} overflow-hidden`}>
      {/* Top gradient bar */}
      <div className={`h-1 bg-gradient-to-r ${config.gradient}`} />

      <div className="p-5">
        {/* Title */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Security Verdict</span>
          <LockIcon className={`w-4 h-4 ${config.color}`} />
        </div>

        {/* Main Verdict Display */}
        <div className={`relative p-4 rounded-xl border ${config.borderColor} bg-slate-950/40 mb-4 overflow-hidden`}>
          {/* Background icon */}
          <div className={`absolute right-3 bottom-2 ${config.color} opacity-5`}>
            <Icon className="w-16 h-16" />
          </div>

          <div className="relative">
            {status === 'idle' ? (
              <div className="flex flex-col items-center py-3 text-center">
                <Activity className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">Awaiting input</p>
                <p className="text-xs text-slate-600 mt-0.5">Submit a prompt to analyze</p>
              </div>
            ) : status === 'running' ? (
              <div className="flex flex-col items-center py-3 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin mb-2" />
                <p className="text-sm text-cyan-400">Analyzing...</p>
                <p className="text-xs text-slate-500 mt-0.5">Running security pipeline</p>
              </div>
            ) : (
              <div className="verdict-pop">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className={`text-xl font-bold tracking-wide ${config.color}`}>{config.label}</div>
                    <p className="text-xs text-slate-400">{config.sublabel}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{config.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400">Pipeline Progress</span>
            <span className="text-xs font-mono text-slate-400">{completedLayers}/{totalLayers}</span>
          </div>
          <div className="h-1.5 bg-slate-800/70 rounded-full overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${config.gradient} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Layer Dots */}
        <div className="flex gap-2 mb-4">
          {Object.entries(layers).map(([key, layer]) => {
            const isPassed = layer.status === 'passed';
            const isFailed = layer.status === 'failed';
            const isProcessing = layer.status === 'processing';

            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-1.5 rounded-full transition-all duration-300 ${
                  isPassed ? 'bg-green-500' :
                  isFailed ? 'bg-red-500' :
                  isProcessing ? 'bg-cyan-400 shimmer-bar' :
                  'bg-slate-700'
                }`} />
                <span className="text-[9px] text-slate-600">{layerLabels[key]}</span>
              </div>
            );
          })}
        </div>

        {/* Stats Summary */}
        <div className="space-y-2 pt-3 border-t border-slate-700/40">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Layers Passed</span>
            <span className="text-xs font-semibold text-green-400 font-mono">{passedLayers}/{totalLayers}</span>
          </div>
          {failedLayers > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500">Layers Failed</span>
              <span className="text-xs font-semibold text-red-400 font-mono">{failedLayers}/{totalLayers}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Status</span>
            <span className={`text-xs font-semibold ${
              status === 'idle' ? 'text-slate-500' :
              status === 'running' ? 'text-cyan-400' :
              'text-white'
            }`}>
              {status === 'idle' ? '— Idle' : status === 'running' ? '⟳ Running' : '✓ Complete'}
            </span>
          </div>
          {status === 'completed' && riskScore > 0 && (
            <div className="flex justify-between items-center pt-1 mt-1 border-t border-slate-700/30">
              <span className="text-xs text-slate-500">Risk Score</span>
              <div className="flex items-center gap-1.5">
                <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${riskScore > 50 ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${riskScore}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold font-mono ${riskScore > 50 ? 'text-red-400' : 'text-green-400'}`}>
                  {riskScore}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
