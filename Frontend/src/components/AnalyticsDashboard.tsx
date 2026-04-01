import { useState, useEffect } from 'react';
import { Target, Activity, CheckCircle, ShieldAlert, Layers, TrendingUp, BarChart2, Radar, ArrowUpRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar as RechartsRadar,
  Cell, Legend
} from 'recharts';

// Mock data for demo (replaces backend call when unavailable)
const MOCK_DATA = {
  full_pipeline: {
    summary: { precision: 0.94, recall: 0.91, f1: 0.925, accuracy: 0.937 },
    layer_catches: { '1': 42, '2': 18, '3': 11, '4': 7, 'none': 4 },
  },
  layer1: { summary: { precision: 0.96, recall: 0.93, f1: 0.945, accuracy: 0.951, false_positive_rate: 0.04, total_samples: 120 } },
  layer2: { summary: { precision: 0.91, recall: 0.88, f1: 0.895, accuracy: 0.903, false_positive_rate: 0.09, total_samples: 85 } },
  layer3: { summary: { precision: 0.89, recall: 0.84, f1: 0.864, accuracy: 0.878, false_positive_rate: 0.12, total_samples: 67 } },
  layer4: { summary: { precision: 0.93, recall: 0.90, f1: 0.915, accuracy: 0.924, false_positive_rate: 0.07, total_samples: 54 } },
};

const LAYER_COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];
const LAYER_NAMES = ['L1: Intent', 'L2: Policy', 'L3: Context', 'L4: Auditor'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass border border-slate-700/60 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs font-semibold text-white mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: <span className="font-mono font-semibold">{(entry.value * 100).toFixed(1)}%</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const RadarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass border border-slate-700/60 rounded-lg px-3 py-2 shadow-xl">
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: <span className="font-mono font-semibold">{(entry.value * 100).toFixed(1)}%</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function AnalyticsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'bar' | 'radar'>('bar');

  useEffect(() => {
    fetch('http://localhost:5000/eval/results')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
        else setData(MOCK_DATA);
        setLoading(false);
      })
      .catch(() => {
        setData(MOCK_DATA);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <p className="text-sm text-cyan-400">Loading analytics...</p>
      </div>
    );
  }

  if (!data) return null;

  const catches = data.full_pipeline?.layer_catches || {};
  const totalAttacks = Object.values(catches).reduce<number>((sum, v) => sum + (v as number), 0);

  // Bar chart data
  const layerKeys = ['layer1', 'layer2', 'layer3', 'layer4'];
  const barChartData = layerKeys.map((key, i) => ({
    name: LAYER_NAMES[i],
    Precision: data[key]?.summary.precision || 0,
    Recall: data[key]?.summary.recall || 0,
    F1: data[key]?.summary.f1 || 0,
    Accuracy: data[key]?.summary.accuracy || 0,
  }));

  // Radar chart data
  const radarData = [
    { metric: 'Precision', ...Object.fromEntries(layerKeys.map((k, i) => [LAYER_NAMES[i], data[k]?.summary.precision || 0])) },
    { metric: 'Recall', ...Object.fromEntries(layerKeys.map((k, i) => [LAYER_NAMES[i], data[k]?.summary.recall || 0])) },
    { metric: 'F1 Score', ...Object.fromEntries(layerKeys.map((k, i) => [LAYER_NAMES[i], data[k]?.summary.f1 || 0])) },
    { metric: 'Accuracy', ...Object.fromEntries(layerKeys.map((k, i) => [LAYER_NAMES[i], data[k]?.summary.accuracy || 0])) },
    { metric: 'FPR (inv)', ...Object.fromEntries(layerKeys.map((k, i) => [LAYER_NAMES[i], 1 - (data[k]?.summary.false_positive_rate || 0)])) },
  ];

  const summaryStats = [
    { label: 'System Accuracy', value: `${(data.full_pipeline?.summary.accuracy * 100).toFixed(1)}%`, icon: CheckCircle, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', trend: '+2.3%' },
    { label: 'Overall F1', value: `${(data.full_pipeline?.summary.f1 * 100).toFixed(1)}%`, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', trend: '+1.8%' },
    { label: 'Precision', value: `${(data.full_pipeline?.summary.precision * 100).toFixed(1)}%`, icon: Activity, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', trend: '+0.9%' },
    { label: 'Recall', value: `${(data.full_pipeline?.summary.recall * 100).toFixed(1)}%`, icon: ShieldAlert, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', trend: '+1.2%' },
  ];

  const catchBars = [
    { key: '1', label: 'Layer 1 (Intent)', color: LAYER_COLORS[0], caught: catches['1'] || 0 },
    { key: '2', label: 'Layer 2 (Policy)', color: LAYER_COLORS[1], caught: catches['2'] || 0 },
    { key: '3', label: 'Layer 3 (Context)', color: LAYER_COLORS[2], caught: catches['3'] || 0 },
    { key: '4', label: 'Layer 4 (Auditor)', color: LAYER_COLORS[3], caught: catches['4'] || 0 },
    { key: 'none', label: 'Bypassed', color: '#ef4444', caught: catches['none'] || 0 },
  ];

  return (
    <div className="w-full space-y-6 pb-10">
      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`glass rounded-xl border p-4 ${stat.bg} relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-20 h-20 opacity-5 -mr-4 -mt-4">
                <Icon className="w-full h-full" />
              </div>
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-slate-900/50 border border-slate-700/30`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-1 text-green-400">
                  <ArrowUpRight className="w-3 h-3" />
                  <span className="text-[10px] font-medium">{stat.trend}</span>
                </div>
              </div>
              <p className={`text-2xl font-bold ${stat.color} font-mono`}>{stat.value}</p>
              <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="glass rounded-xl border border-slate-700/50 overflow-hidden">
        {/* Chart Header + Toggle */}
        <div className="px-6 py-4 border-b border-slate-700/40 bg-slate-900/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Layer Performance Metrics</h2>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-800/60 rounded-lg border border-slate-700/40">
            <button
              onClick={() => setActiveChart('bar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeChart === 'bar' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart2 className="w-3 h-3" />
              Bar
            </button>
            <button
              onClick={() => setActiveChart('radar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeChart === 'radar' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radar className="w-3 h-3" />
              Radar
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeChart === 'bar' ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barChartData} barGap={2} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0.7, 1]}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(6,182,212,0.05)' }} />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '16px' }} />
                <Bar dataKey="Precision" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Recall" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="F1" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Accuracy" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(71,85,105,0.4)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<RadarTooltip />} />
                {LAYER_NAMES.map((name, i) => (
                  <RechartsRadar
                    key={name}
                    name={name}
                    dataKey={name}
                    stroke={LAYER_COLORS[i]}
                    fill={LAYER_COLORS[i]}
                    fillOpacity={0.08}
                    strokeWidth={1.5}
                  />
                ))}
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8', paddingTop: '8px' }} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Two Column Layout: Defense Depth + Individual Layer Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Defense in Depth - 2 cols */}
        <div className="xl:col-span-2 glass rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/40 bg-slate-900/30 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Defense in Depth</h2>
            <span className="ml-auto text-xs text-slate-500">{totalAttacks} total</span>
          </div>
          <div className="p-5 space-y-4">
            {catchBars.map((bar) => {
              const pct = totalAttacks > 0 ? ((bar.caught / totalAttacks) * 100) : 0;
              return (
                <div key={bar.key}>
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-slate-300">{bar.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold" style={{ color: bar.color }}>{bar.caught} caught</span>
                      <span className="text-slate-600 font-mono">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: bar.color }}
                    />
                  </div>
                </div>
              );
            })}

            {/* Donut legend */}
            <div className="pt-3 border-t border-slate-700/40 flex flex-wrap gap-2">
              {catchBars.map((bar) => (
                <div key={bar.key} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bar.color }} />
                  <span className="text-[10px] text-slate-500">{bar.label.split(' ')[0]} {bar.label.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Individual Layer Cards - 3 cols */}
        <div className="xl:col-span-3 grid grid-cols-2 gap-4">
          {layerKeys.map((key, i) => {
            const layerData = data[key];
            if (!layerData) return null;
            const m = layerData.summary;
            const fpr = m.false_positive_rate !== undefined ? m.false_positive_rate : (m.fpr || 0);

            return (
              <div key={key} className="glass rounded-xl border border-slate-700/50 overflow-hidden flex flex-col">
                {/* Top accent bar */}
                <div className="h-0.5" style={{ backgroundColor: LAYER_COLORS[i] }} />
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded border"
                      style={{ color: LAYER_COLORS[i], backgroundColor: `${LAYER_COLORS[i]}18`, borderColor: `${LAYER_COLORS[i]}40` }}
                    >
                      {['L1', 'L2', 'L3', 'L4'][i]}
                    </span>
                    <h3 className="text-xs font-semibold text-white truncate">{['Intent Classifier', 'Semantic Policy', 'Context Integrity', 'Response Auditor'][i]}</h3>
                  </div>

                  <div className="space-y-2 flex-1">
                    {[
                      { label: 'Precision', val: m.precision, color: LAYER_COLORS[0] },
                      { label: 'Recall', val: m.recall, color: LAYER_COLORS[2] },
                      { label: 'F1 Score', val: m.f1, color: LAYER_COLORS[1] },
                      { label: 'FPR', val: fpr, color: '#ef4444', invert: true },
                    ].map((metric) => (
                      <div key={metric.label} className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{metric.label}</span>
                        <span className="text-[10px] font-mono font-semibold text-white">{(metric.val * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>

                  {/* Accuracy bar */}
                  <div className="mt-3 pt-3 border-t border-slate-700/30">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] text-slate-500">Accuracy</span>
                      <span className="text-xs font-bold font-mono text-white">{(m.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${m.accuracy * 100}%`, backgroundColor: LAYER_COLORS[i] }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
