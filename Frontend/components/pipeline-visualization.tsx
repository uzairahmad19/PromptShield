'use client';

import { CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';

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
  { id: 'intentClassifier', name: 'Intent Classifier', color: 'from-cyan-500 to-blue-600' },
  { id: 'semanticPolicy', name: 'Semantic Policy', color: 'from-green-500 to-emerald-600' },
  { id: 'contextIntegrity', name: 'Context Integrity', color: 'from-amber-500 to-orange-600' },
  { id: 'responseAuditor', name: 'Response Auditor', color: 'from-indigo-500 to-purple-600' },
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
      return <AlertCircle className="w-5 h-5 text-slate-500" />;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'passed':
      return 'border-green-500/50 bg-green-500/10';
    case 'failed':
      return 'border-red-500/50 bg-red-500/10';
    case 'processing':
      return 'border-cyan-500/50 bg-cyan-500/10 border-glow';
    default:
      return 'border-slate-700/50 bg-slate-800/50';
  }
}

function PipelineLayer({ layer, layerState, index }: any) {
  return (
    <div className="flex items-center gap-4">
      {/* Layer Card */}
      <div className={`flex-1 glass rounded-lg border p-6 transition-all duration-300 ${getStatusColor(layerState.status)}`}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-white text-sm">{layer.name}</h3>
            <p className="text-xs text-slate-400 mt-1">{layerState.message}</p>
          </div>
          <div className="flex-shrink-0">{getStatusIcon(layerState.status)}</div>
        </div>

        {/* Progress bar for processing state */}
        {layerState.status === 'processing' && (
          <div className="w-full h-1 bg-slate-900/50 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 animate-pulse"></div>
          </div>
        )}
      </div>

      {/* Arrow to next layer */}
      {index < LAYERS.length - 1 && (
        <div className="flex-shrink-0 px-3">
          <div className={`text-2xl transition-colors ${
            layerState.status === 'passed' ? 'text-green-400' : 
            layerState.status === 'failed' ? 'text-red-400' : 
            'text-slate-600'
          }`}>
            →
          </div>
        </div>
      )}
    </div>
  );
}

export function PipelineVisualization({ state }: PipelineVisualizationProps) {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-white mb-2">Semantic Guardrail Pipeline</h2>
        <p className="text-sm text-slate-400">Four-layer security analysis pipeline</p>
      </div>

      {/* Vertical Pipeline */}
      <div className="space-y-4">
        {LAYERS.map((layer, index) => (
          <PipelineLayer
            key={layer.id}
            layer={layer}
            layerState={state[layer.id as keyof typeof state]}
            index={index}
          />
        ))}
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-4 gap-3 mt-8 pt-6 border-t border-slate-700/50">
        {LAYERS.map((layer) => {
          const status = state[layer.id as keyof typeof state];
          const isPassed = status.status === 'passed';
          const isFailed = status.status === 'failed';

          return (
            <div
              key={layer.id}
              className={`p-3 rounded-lg text-center text-xs glass border transition-all ${
                isPassed
                  ? 'border-green-500/50 bg-green-500/10'
                  : isFailed
                  ? 'border-red-500/50 bg-red-500/10'
                  : 'border-slate-700/50 bg-slate-800/50'
              }`}
            >
              <div className="font-semibold text-white text-xs mb-1">{layer.name}</div>
              <div className={`text-xs font-mono ${
                isPassed ? 'text-green-300' : isFailed ? 'text-red-300' : 'text-slate-400'
              }`}>
                {status.status.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
