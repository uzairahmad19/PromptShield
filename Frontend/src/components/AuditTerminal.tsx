import { useRef, useEffect, useState } from 'react';
import { Terminal, Database, RefreshCw, Loader2, Search, X, Filter, Download, ChevronDown } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

interface Log {
  level: string;
  message: string;
  timestamp: string;
}

interface AuditTerminalProps {
  logs?: Log[];
  mode?: 'stream' | 'history';
  className?: string;
}

function getLevelColor(level: string) {
  switch (level.toUpperCase()) {
    case 'INFO': return 'text-cyan-300';
    case 'WARN': return 'text-amber-300';
    case 'CRITICAL': return 'text-red-300';
    case 'SUCCESS': return 'text-green-300';
    default: return 'text-slate-300';
  }
}

function getLevelBg(level: string) {
  switch (level.toUpperCase()) {
    case 'INFO': return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20';
    case 'WARN': return 'bg-amber-500/15 text-amber-300 border-amber-500/20';
    case 'CRITICAL': return 'bg-red-500/15 text-red-300 border-red-500/20';
    case 'SUCCESS': return 'bg-green-500/15 text-green-300 border-green-500/20';
    default: return 'bg-slate-800/50 text-slate-400 border-slate-700/30';
  }
}

function getLevelDot(level: string) {
  switch (level.toUpperCase()) {
    case 'INFO': return 'bg-cyan-400';
    case 'WARN': return 'bg-amber-400';
    case 'CRITICAL': return 'bg-red-400';
    case 'SUCCESS': return 'bg-green-400';
    default: return 'bg-slate-500';
  }
}

const LEVEL_FILTERS = ['ALL', 'INFO', 'SUCCESS', 'WARN', 'CRITICAL'];

export function AuditTerminal({ logs: propLogs = [], mode = 'stream', className = 'h-64' }: AuditTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [historyLogs, setHistoryLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [showFilters, setShowFilters] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    if (mode === 'history') fetchHistory();
  }, [mode]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/logs?n=200`);
      const result = await res.json();
      if (result.success && result.data?.entries) {
        const mappedLogs = result.data.entries.map((entry: any) => {
          let level = 'INFO';
          if (entry.decision === 'BLOCK') level = 'CRITICAL';
          else if (entry.decision === 'PASS') level = 'SUCCESS';
          else if (entry.level) level = entry.level;

          let msg = '';
          if (entry.event === 'pipeline_start') msg = `[START] Evaluating query: "${entry.query}"`;
          else if (entry.event === 'pipeline_end') msg = `[END] Pipeline complete. Final decision: ${entry.decision}`;
          else if (entry.layer) msg = `[Layer ${entry.layer}] ${entry.decision} - ${entry.reason}`;
          else msg = entry.reason || entry.event || JSON.stringify(entry);

          return { level, message: msg, timestamp: entry.ts || new Date().toISOString() };
        });
        setHistoryLogs(mappedLogs);
      }
    } catch (error) {
      console.error('Failed to fetch history logs', error);
    } finally {
      setIsLoading(false);
    }
  };

  const rawLogs = mode === 'stream' ? propLogs : historyLogs;

  const displayLogs = rawLogs.filter((log) => {
    const matchesLevel = levelFilter === 'ALL' || log.level.toUpperCase() === levelFilter;
    const matchesSearch = !searchQuery || log.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  useEffect(() => {
    if (terminalRef.current && mode === 'stream' && autoScroll) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [displayLogs, mode, autoScroll]);

  const handleExport = () => {
    const text = displayLogs
      .map((l) => `[${new Date(l.timestamp).toLocaleString()}] [${l.level}] ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promptshield-audit-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const levelCounts = LEVEL_FILTERS.slice(1).reduce<Record<string, number>>((acc, lvl) => {
    acc[lvl] = rawLogs.filter(l => l.level.toUpperCase() === lvl).length;
    return acc;
  }, {});

  return (
    <div className={`glass rounded-xl border border-slate-700/50 overflow-hidden flex flex-col ${className}`}>
      {/* Header */}
      <div className="glass border-b border-slate-700/40 px-4 py-3 flex items-center justify-between gap-3 bg-slate-900/40 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'stream'
            ? <Terminal className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            : <Database className="w-4 h-4 text-cyan-400 flex-shrink-0" />}
          <span className="text-sm font-semibold text-white truncate">
            {mode === 'stream' ? 'Live Audit Terminal' : 'Database Audit History'}
          </span>
          <span className="text-xs text-slate-500 flex-shrink-0">
            ({displayLogs.length}{rawLogs.length !== displayLogs.length ? `/${rawLogs.length}` : ''} events)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="w-40 pl-6 pr-2 py-1 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-slate-500 hover:text-white" />
              </button>
            )}
          </div>

          {/* Level Filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/60 border border-slate-700/50 rounded-lg text-xs text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
            >
              <Filter className="w-3 h-3" />
              <span>{levelFilter}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {showFilters && (
              <div className="absolute right-0 top-full mt-1 w-36 glass border border-slate-700/60 rounded-lg shadow-2xl z-50 overflow-hidden">
                {LEVEL_FILTERS.map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => { setLevelFilter(lvl); setShowFilters(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-slate-800/60 transition-colors ${
                      levelFilter === lvl ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-400'
                    }`}
                  >
                    <span>{lvl}</span>
                    {lvl !== 'ALL' && levelCounts[lvl] > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getLevelBg(lvl)}`}>
                        {levelCounts[lvl]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={handleExport}
            disabled={displayLogs.length === 0}
            className="p-1.5 text-slate-500 hover:text-cyan-400 disabled:opacity-40 transition-colors"
            title="Export logs"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Refresh (history mode) */}
          {mode === 'history' && (
            <button onClick={fetchHistory} disabled={isLoading} className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
          )}

          {/* Auto-scroll toggle (stream mode) */}
          {mode === 'stream' && (
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                autoScroll
                  ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
                  : 'text-slate-500 bg-slate-800/50 border-slate-700/40 hover:text-slate-300'
              }`}
            >
              AUTO
            </button>
          )}
        </div>
      </div>

      {/* Level Filter Badges (quick stats) */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/30 border-b border-slate-800/40 flex-shrink-0">
        {LEVEL_FILTERS.slice(1).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(levelFilter === lvl ? 'ALL' : lvl)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium transition-all ${
              levelFilter === lvl ? getLevelBg(lvl) : 'bg-transparent border-slate-800/60 text-slate-600 hover:text-slate-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getLevelDot(lvl)}`} />
            <span>{lvl}</span>
            <span className="font-mono">({levelCounts[lvl] || 0})</span>
          </button>
        ))}
      </div>

      {/* Terminal Content */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-slate-950/40"
        style={{ scrollBehavior: 'smooth' }}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
          if (!atBottom && autoScroll && mode === 'stream') setAutoScroll(false);
        }}
      >
        {isLoading && mode === 'history' ? (
          <div className="flex justify-center items-center h-full text-cyan-500">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
            <Terminal className="w-8 h-8 opacity-30" />
            <p className="text-xs">
              {searchQuery || levelFilter !== 'ALL'
                ? 'No logs match the current filters'
                : 'No audit logs yet...'}
            </p>
          </div>
        ) : (
          displayLogs.map((log, index) => {
            const timestamp = isMounted
              ? new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : '--:--:--';
            const isNew = mode === 'stream' && index === displayLogs.length - 1;

            return (
              <div
                key={index}
                className={`flex gap-2 items-start hover:bg-slate-900/40 px-2 py-1 rounded transition-colors group ${isNew ? 'terminal-line' : ''}`}
              >
                {/* Colored dot */}
                <div className="flex-shrink-0 flex items-center h-4 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getLevelDot(log.level)}`} />
                </div>

                {/* Timestamp */}
                <span className="text-slate-600 flex-shrink-0 w-16 tabular-nums">{timestamp}</span>

                {/* Level Badge */}
                <span className={`px-1.5 py-0.5 rounded border text-[10px] tracking-wider font-bold flex-shrink-0 w-[62px] text-center ${getLevelBg(log.level)}`}>
                  {log.level.length > 7 ? log.level.slice(0, 7) : log.level}
                </span>

                {/* Message */}
                <span className={`flex-1 break-all leading-relaxed ${getLevelColor(log.level)}`}>
                  {log.message}
                </span>
              </div>
            );
          })
        )}

        {/* Cursor blink at end in stream mode */}
        {mode === 'stream' && !isLoading && (
          <div className="px-4 py-1 text-slate-600 cursor-blink">_</div>
        )}
      </div>

      {/* Footer */}
      <div className="glass border-t border-slate-700/40 px-4 py-2 bg-slate-900/40 flex items-center justify-between flex-shrink-0">
        <p className="text-xs text-slate-600">
          {mode === 'stream' ? '● Streaming live' : '◆ Last 200 records'}
          {(searchQuery || levelFilter !== 'ALL') && (
            <span className="ml-2 text-cyan-500">
              Filtered: {displayLogs.length} shown
            </span>
          )}
        </p>
        {(searchQuery || levelFilter !== 'ALL') && (
          <button
            onClick={() => { setSearchQuery(''); setLevelFilter('ALL'); }}
            className="text-xs text-slate-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
