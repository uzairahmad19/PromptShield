import { CheckCircle2, XCircle, Clock, AlertCircle, ArrowDown, Cpu, ScanSearch, Eye } from 'lucide-react';

interface LayerState {
  status: 'pending' | 'processing' | 'passed' | 'failed';
  message: string;
}

interface PipelineVisualizationProps {
  state: {
    intentClassifier: LayerState;
    semanticPolicy: LayerState;
    contextIntegrity: LayerState;
    responseAuditor: LayerState;
  };
}

const LAYERS = [
  {
    id: 'intentClassifier',
    name: 'Intent Classifier',
    subtitle: 'Jailbreak & injection detection',
    icon: ScanSearch,
    badge: 'L1',
    gradient: 'from-cyan-500 to-blue-600',
    glow: 'shadow-cyan-500/20',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  },
  {
    id: 'semanticPolicy',
    name: 'Semantic Policy',
    subtitle: 'Rule violation enforcement',
    icon: Eye,
    badge: 'L2',
    gradient: 'from-emerald-500 to-green-600',
    glow: 'shadow-emerald-500/20',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  {
    id: 'contextIntegrity',
    name: 'Context Integrity',
    subtitle: 'Indirect injection analysis',
    icon: Eye,
    badge: 'L3',
    gradient: 'from-amber-500 to-orange-600',
    glow: 'shadow-amber-500/20',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  {
    id: 'responseAuditor',
    name: 'Response Auditor',
    subtitle: 'PII & toxicity screening',
    icon: Eye,
    badge: 'L4',
    gradient: 'from-indigo-500 to-purple-600',
    glow: 'shadow-indigo-500/20',
    badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  },
];

function getStatusIcon(status: string) {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="w-5 h-5 text-green-400" />;
    case 'failed':
      return <XCircle className="w-5 h-5 text-red-400" />;
    case 'processing':
      return <Clock className="w-5 h-5 text-cyan-400 animate-spin" />;
    default:
      return <AlertCircle className="w-5 h-5 text-slate-600" />;
  }
}

function getStatusBorder(status: string) {
  switch (status) {
    case 'passed':
      return 'border-green-500/40 bg-green-500/5';
    case 'failed':
      return 'border-red-500/40 bg-red-500/5';
    case 'processing':
      return 'border-cyan-500/50 bg-cyan-500/5 border-glow';
    default:
      return 'border-slate-700/40 bg-slate-800/30';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'passed': return { text: 'PASSED', color: 'text-green-400 bg-green-500/10 border-green-500/30' };
    case 'failed': return { text: 'BLOCKED', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
    case 'processing': return { text: 'RUNNING', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' };
    default: return { text: 'IDLE', color: 'text-slate-500 bg-slate-800/50 border-slate-700/30' };
  }
}

function ConnectorArrow({ prevStatus }: { prevStatus: string }) {
  const isActive = prevStatus === 'passed';
  const isFailed = prevStatus === 'failed';
  return (
    <div className="flex justify-center py-1">
      <div className="relative flex flex-col items-center">
        <div className={`w-0.5 h-5 rounded-full transition-all duration-500 ${
          isActive ? 'bg-gradient-to-b from-green-400 to-green-500/50' :
          isFailed ? 'bg-red-500/30' : 'bg-slate-700/50'
        }`} />
        <ArrowDown className={`w-3.5 h-3.5 -mt-0.5 transition-colors duration-500 ${
          isActive ? 'text-green-400' : isFailed ? 'text-red-500/40' : 'text-slate-700'
        }`} />
      </div>
    </div>
  );
}

export function PipelineVisualization({ state }: PipelineVisualizationProps) {
  const overallStatus = Object.values(state).some(l => l.status === 'failed')
    ? 'failed'
    : Object.values(state).every(l => l.status === 'passed')
    ? 'passed'
    : Object.values(state).some(l => l.status === 'processing')
    ? 'processing'
    : 'idle';

  return (
    <div className="glass rounded-xl border border-slate-700/50 overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-3.5 border-b border-slate-700/40 bg-slate-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Semantic Guardrail Pipeline</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">4-Layer Defense</span>
          {overallStatus !== 'idle' && (
            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${getStatusLabel(overallStatus).color}`}>
              {getStatusLabel(overallStatus).text}
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Pipeline Layers */}
        <div className="space-y-1">
          {LAYERS.map((layer, index) => {
            const layerState = state[layer.id as keyof typeof state];
            const Icon = layer.icon;
            const statusLabel = getStatusLabel(layerState.status);

            return (
              <div key={layer.id}>
                <div className={`rounded-xl border p-4 transition-all duration-400 ${getStatusBorder(layerState.status)}`}>
                  <div className="flex items-start gap-3">
                    {/* Layer Number Badge */}
                    <div className={`flex-shrink-0 flex flex-col items-center gap-1`}>
                      <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs ${layer.badgeBg}`}>
                        {layer.badge}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{layer.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{layer.subtitle}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${statusLabel.color}`}>
                            {statusLabel.text}
                          </span>
                          {getStatusIcon(layerState.status)}
                        </div>
                      </div>

                      {/* Message */}
                      <div className="mt-2">
                        <p className="text-xs text-slate-400 truncate">{layerState.message}</p>
                      </div>

                      {/* Processing Bar */}
                      {layerState.status === 'processing' && (
                        <div className="mt-2 h-0.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full shimmer-bar rounded-full" />
                        </div>
                      )}
                      {layerState.status === 'passed' && (
                        <div className="mt-2 h-0.5 bg-green-500/20 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full w-full" />
                        </div>
                      )}
                      {layerState.status === 'failed' && (
                        <div className="mt-2 h-0.5 bg-red-500/20 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full w-full" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connector Arrow */}
                {index < LAYERS.length - 1 && (
                  <ConnectorArrow prevStatus={layerState.status} />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom Summary Grid */}
        <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-700/40">
          {LAYERS.map((layer) => {
            const layerState = state[layer.id as keyof typeof state];
            const isPassed = layerState.status === 'passed';
            const isFailed = layerState.status === 'failed';
            const isProcessing = layerState.status === 'processing';

            return (
              <div
                key={layer.id}
                className={`py-2 px-2 rounded-lg text-center border transition-all ${
                  isPassed ? 'border-green-500/30 bg-green-500/5' :
                  isFailed ? 'border-red-500/30 bg-red-500/5' :
                  isProcessing ? 'border-cyan-500/30 bg-cyan-500/5' :
                  'border-slate-700/40 bg-slate-800/30'
                }`}
              >
                <div className={`text-[9px] font-bold mb-1 ${layer.badgeBg.split(' ')[1]}`}>{layer.badge}</div>
                <div className={`text-[9px] font-mono font-semibold ${
                  isPassed ? 'text-green-300' : isFailed ? 'text-red-300' : isProcessing ? 'text-cyan-300' : 'text-slate-500'
                }`}>
                  {layerState.status.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}