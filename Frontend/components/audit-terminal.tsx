'use client';

import { useRef, useEffect } from 'react';
import { Terminal, Copy } from 'lucide-react';

interface Log {
  level: string;
  message: string;
  timestamp: string;
}

interface AuditTerminalProps {
  logs: Log[];
}

function getLevelColor(level: string) {
  switch (level.toUpperCase()) {
    case 'INFO':
      return 'text-cyan-300';
    case 'WARN':
      return 'text-amber-300';
    case 'CRITICAL':
      return 'text-red-300';
    default:
      return 'text-slate-300';
  }
}

function getLevelBg(level: string) {
  switch (level.toUpperCase()) {
    case 'INFO':
      return 'bg-cyan-500/10 text-cyan-300';
    case 'WARN':
      return 'bg-amber-500/10 text-amber-300';
    case 'CRITICAL':
      return 'bg-red-500/10 text-red-300';
    default:
      return 'bg-slate-800/50 text-slate-300';
  }
}

export function AuditTerminal({ logs }: AuditTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass rounded-lg border border-slate-700/50 overflow-hidden flex flex-col h-64">
      {/* Header */}
      <div className="glass border-b border-slate-700/50 px-4 py-3 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Audit Terminal</span>
          <span className="text-xs text-slate-500">({logs.length} events)</span>
        </div>
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 bg-slate-950/50"
        style={{ scrollBehavior: 'smooth' }}
      >
        {logs.length === 0 ? (
          <div className="text-slate-500 py-8 text-center">
            <p>No audit logs yet...</p>
          </div>
        ) : (
          logs.map((log, index) => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            return (
              <div
                key={index}
                className="flex gap-3 items-start hover:bg-slate-900/30 px-2 py-1 rounded transition-colors group"
              >
                {/* Timestamp */}
                <span className="text-slate-600 flex-shrink-0 min-w-fit">{timestamp}</span>

                {/* Level Badge */}
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 min-w-fit ${getLevelBg(
                    log.level
                  )}`}
                >
                  {log.level}
                </span>

                {/* Message */}
                <span className={`flex-1 break-words ${getLevelColor(log.level)}`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="glass border-t border-slate-700/50 px-4 py-2 bg-slate-900/50 flex items-center justify-between">
        <p className="text-xs text-slate-500">Streaming logs • Auto-scroll enabled</p>
      </div>
    </div>
  );
}
