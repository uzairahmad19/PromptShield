'use client';

import { useState, useEffect } from 'react';
import { Target, Activity, CheckCircle, ShieldAlert, Layers } from 'lucide-react';

export function AnalyticsDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/eval/results')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setData(result.data);
        else setError(result.error);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to fetch analytics data');
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8 text-cyan-400 animate-pulse">Loading analytics...</div>;
  if (error) return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data) return null;

  // Dynamically calculate total attacks for the progress bars
  const catches = data.full_pipeline?.layer_catches || {};
  const totalAttacks = 
    (catches["1"] || 0) + 
    (catches["2"] || 0) + 
    (catches["3"] || 0) + 
    (catches["4"] || 0) + 
    (catches["none"] || 0);

  const MetricRow = ({ title, value, icon: Icon, colorClass }: any) => (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800/50 hover:bg-slate-800/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-md bg-slate-900 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-slate-300">{title}</span>
      </div>
      <span className="text-lg font-semibold text-white">
        {typeof value === 'number' ? (value * 100).toFixed(1) + '%' : (value || '0%')}
      </span>
    </div>
  );

  const LayerCard = ({ layerName, metrics, desc }: any) => {
    // Safely extract FPR depending on which json generated it
    const fpr = metrics.false_positive_rate !== undefined ? metrics.false_positive_rate : (metrics.fpr || 0);
    
    return (
      <div className="glass p-6 rounded-xl border border-slate-700/50 bg-slate-900/30 flex flex-col h-full relative overflow-hidden shadow-lg">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-emerald-500 opacity-75" />
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-2">{layerName}</h2>
          <p className="text-sm text-slate-400 min-h-[40px]">{desc}</p>
        </div>
        <div className="flex flex-col gap-3 flex-grow mb-6">
          <MetricRow title="Precision" value={metrics.precision} icon={Target} colorClass="text-cyan-400" />
          <MetricRow title="Recall" value={metrics.recall} icon={Activity} colorClass="text-amber-400" />
          <MetricRow title="F1 Score" value={metrics.f1} icon={CheckCircle} colorClass="text-emerald-400" />
          <MetricRow title="False Positives" value={fpr} icon={ShieldAlert} colorClass="text-red-400" />
        </div>
        <div className="mt-auto p-4 rounded-lg bg-slate-950/50 border border-slate-800/50">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-slate-300">Accuracy</span>
            <span className="text-xl font-bold text-white">{(metrics.accuracy * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${metrics.accuracy * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-cyan-400" /> System Analytics
          </h1>
          <p className="text-slate-400 mt-1">Live evaluation metrics across the PromptShield architecture</p>
        </div>
      </div>

      {/* --- FULL PIPELINE HERO CARD --- */}
      {data.full_pipeline && (
        <div className="glass p-8 rounded-xl border border-cyan-500/30 bg-slate-900/40 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-6">
            <Layers className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Overall System Performance</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left: Metrics */}
            <div className="space-y-4">
              <p className="text-slate-400 text-sm mb-4">End-to-end performance metrics evaluating defense-in-depth across multiple layers.</p>
              <div className="grid grid-cols-2 gap-4">
                 <MetricRow title="Total Precision" value={data.full_pipeline.summary.precision} icon={Target} colorClass="text-cyan-400" />
                 <MetricRow title="Total Recall" value={data.full_pipeline.summary.recall} icon={Activity} colorClass="text-amber-400" />
                 <MetricRow title="Overall F1" value={data.full_pipeline.summary.f1} icon={CheckCircle} colorClass="text-emerald-400" />
                 <MetricRow title="Total Accuracy" value={data.full_pipeline.summary.accuracy} icon={Target} colorClass="text-cyan-400" />
              </div>
            </div>

            {/* Right: Layer Catch Contributions */}
            <div className="glass p-5 rounded-lg border border-slate-700/50 bg-slate-950/50 flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Defense in Depth: Attack Interception</h3>
              
              <div className="space-y-4">
                {/* L1 Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Layer 1 (Intent)</span>
                    <span className="text-cyan-400 font-mono">{catches["1"] || 0} caught</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${((catches["1"] || 0) / totalAttacks) * 100}%` }} />
                  </div>
                </div>

                {/* L2 Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Layer 2 (Policy)</span>
                    <span className="text-emerald-400 font-mono">{catches["2"] || 0} caught</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${((catches["2"] || 0) / totalAttacks) * 100}%` }} />
                  </div>
                </div>

                {/* L3 Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Layer 3 (Context)</span>
                    <span className="text-purple-400 font-mono">{catches["3"] || 0} caught</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${((catches["3"] || 0) / totalAttacks) * 100}%` }} />
                  </div>
                </div>

                {/* L4 Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">Layer 4 (Auditor)</span>
                    <span className="text-amber-400 font-mono">{catches["4"] || 0} caught</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${((catches["4"] || 0) / totalAttacks) * 100}%` }} />
                  </div>
                </div>
                
                {/* Missed Bar */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Bypassed</span>
                    <span className="text-red-400 font-mono">{catches["none"] || 0} missed</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: `${((catches["none"] || 0) / totalAttacks) * 100}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- INDIVIDUAL LAYER CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {data.layer1 && (
          <LayerCard 
            layerName="L1: Intent Classifier" 
            desc={`Evaluated on ${data.layer1.summary.total_samples || 'various'} samples (Jailbreaks & Prompt Extraction)`}
            metrics={data.layer1.summary} 
          />
        )}
        {data.layer2 && (
          <LayerCard 
            layerName="L2: Semantic Policy" 
            desc={`Evaluated on ${data.layer2.summary.total_samples || 'various'} samples against specific rule violations`}
            metrics={data.layer2.summary} 
          />
        )}
        {data.layer3 && (
          <LayerCard 
            layerName="L3: Context Integrity" 
            desc={`Evaluated on ${data.layer3.summary.total_samples || 'various'} indirect injection (tool output) samples`}
            metrics={data.layer3.summary} 
          />
        )}
        {data.layer4 && (
          <LayerCard 
            layerName="L4: Response Auditor" 
            desc={`Evaluated on generated responses for PII leaks, system prompt leakage, and toxicity`}
            metrics={data.layer4.summary} 
          />
        )}
      </div>
    </div>
  );
}