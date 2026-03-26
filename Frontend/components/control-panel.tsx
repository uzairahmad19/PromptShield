'use client';

import { useState } from 'react';
import { Play, Zap } from 'lucide-react';

interface ControlPanelProps {
  input: string;
  onExecute: (input: string) => void;
  onSimulateAttack: () => void;
  isRunning: boolean;
}

export function ControlPanel({
  input,
  onExecute,
  onSimulateAttack,
  isRunning,
}: ControlPanelProps) {
  const [localInput, setLocalInput] = useState('');

  const handleExecute = () => {
    if (localInput.trim()) {
      onExecute(localInput);
    }
  };

  return (
    <div className="glass rounded-lg p-6 border border-slate-700/50">
      <label className="block text-sm font-semibold text-white mb-3">Prompt Input</label>
      <textarea
        value={localInput}
        onChange={(e) => setLocalInput(e.target.value)}
        disabled={isRunning}
        placeholder="Enter a prompt to analyze through the PromptShield pipeline..."
        className="w-full h-24 bg-slate-950/50 border border-slate-700 rounded-lg p-4 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
      />

      {/* Buttons */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={handleExecute}
          disabled={isRunning || !localInput.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          Execute Pipeline
        </button>

        <button
          onClick={onSimulateAttack}
          disabled={isRunning}
          className="flex items-center gap-2 px-6 py-2.5 bg-red-950/40 hover:bg-red-950/60 border border-red-500/50 text-red-300 font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Zap className="w-4 h-4" />
          Simulate Attack
        </button>
      </div>

      <p className="text-xs text-slate-400 mt-3">
        💡 Tip: Try entering text with "jailbreak" to trigger security blocking
      </p>
    </div>
  );
}
