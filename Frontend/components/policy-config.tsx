'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings2, Save, Loader2, AlertTriangle, Info } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

interface Policy {
  id: string;
  name?: string;
  description?: string;
  text?: string;
  enabled: boolean;
  severity: string;
  violation_examples?: string[];
}

type ConfirmAction = {
  type: 'DELETE' | 'TOGGLE';
  policy: Policy;
} | null;

export function PolicyConfig() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [newPolicyText, setNewPolicyText] = useState('');
  
  // Status states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Modal State
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  // Load policies from backend on mount
  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/policies`);
      const result = await res.json();
      
      if (result.success && result.data && result.data.policies) {
        const mappedPolicies = result.data.policies.map((p: any) => ({
          id: p.id,
          name: p.name || 'Custom Policy',
          description: p.description || p.text || '',
          text: p.text || p.description || '', 
          enabled: p.enabled ?? true,
          severity: p.severity || 'MEDIUM',
          violation_examples: p.violation_examples || [],
        }));
        
        setPolicies(mappedPolicies);
      }
    } catch (error) {
      console.error("Failed to fetch policies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPolicy = () => {
    if (!newPolicyText.trim()) return;
    const newPolicy: Policy = {
      id: `p_${Date.now()}`,
      name: 'Custom Rule',
      description: newPolicyText,
      text: newPolicyText,
      enabled: true,
      severity: 'MEDIUM',
      violation_examples: [newPolicyText],
    };
    setPolicies([...policies, newPolicy]);
    setNewPolicyText('');
    setHasUnsavedChanges(true); 
  };

  const savePoliciesToBackend = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/policies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies }),
      });
      const data = await res.json();
      if (data.success) {
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Failed to save policies:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- API EXECUTION FUNCTIONS ---

  const executeTogglePolicy = async (id: string) => {
    const policyToToggle = policies.find(p => p.id === id);
    if (!policyToToggle) return;
    
    const newEnabledState = !policyToToggle.enabled;

    // Optimistically update the UI
    setPolicies(policies.map(p => p.id === id ? { ...p, enabled: newEnabledState } : p));

    try {
      const res = await fetch(`${API_BASE_URL}/policies/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabledState }),
      });
      const data = await res.json();
      
      if (!data.success) {
        console.error("Failed to update policy status:", data.error);
        setPolicies(prev => prev.map(p => p.id === id ? { ...p, enabled: !newEnabledState } : p));
      }
    } catch (error) {
      console.error("Error updating policy status:", error);
      setPolicies(prev => prev.map(p => p.id === id ? { ...p, enabled: !newEnabledState } : p));
    }
  };

  const executeDeletePolicy = async (id: string) => {
    // Optimistically update the UI
    setPolicies(policies.filter(p => p.id !== id));
    
    try {
      const res = await fetch(`${API_BASE_URL}/policies/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        console.error("Failed to delete policy on backend:", data.error);
      }
    } catch (error) {
      console.error("Error triggering delete endpoint:", error);
    }
  };

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-cyan-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <>
      <div className="max-w-5xl mx-auto flex flex-col gap-6 h-full pb-8">
        
        {/* Header & Add New Policy Card */}
        <div className="glass rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-semibold text-white">Semantic Policy Configuration</h2>
            </div>
            {/* Deploy Changes Button */}
            <button
              onClick={savePoliciesToBackend}
              disabled={!hasUnsavedChanges || isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                hasUnsavedChanges 
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Deploying...' : hasUnsavedChanges ? 'Deploy Changes' : 'Saved'}
            </button>
          </div>
          <p className="text-sm text-slate-400 mb-4">
            Define the semantic rules and boundaries for your AI agent. These policies are actively embedded and enforced at Layer 2 to prevent role overrides, instruction bypasses, and unauthorized actions.
          </p>
          <div className="flex flex-col gap-3">
            <textarea
              value={newPolicyText}
              onChange={(e) => setNewPolicyText(e.target.value)}
              placeholder="e.g., 'Never generate code that includes hardcoded credentials...'"
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none h-20"
            />
            <button
              onClick={handleAddPolicy}
              disabled={!newPolicyText.trim()}
              className="self-end flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add Rule
            </button>
          </div>
        </div>

        {/* Active Policies List */}
        <div className="glass rounded-xl border border-slate-700/50 flex-1 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-700/50 bg-slate-800/20">
            <h2 className="text-lg font-semibold text-white">Active Ruleset</h2>
          </div>
          <div className="p-6 overflow-y-auto flex flex-col gap-4">
            {policies.map((policy) => (
              <div 
                key={policy.id} 
                className={`flex flex-col gap-4 p-4 rounded-lg border transition-all ${
                  policy.enabled ? 'bg-slate-800/40 border-slate-600' : 'bg-slate-900/40 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-cyan-400 mb-1 tracking-wide uppercase">
                      {policy.name}
                    </h3>
                    <p className="text-sm text-slate-200">
                      {policy.description || policy.text}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* Open Toggle Modal */}
                    <button 
                      onClick={() => setConfirmAction({ type: 'TOGGLE', policy })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        policy.enabled ? 'bg-cyan-500' : 'bg-slate-600'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        policy.enabled ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                    {/* Open Delete Modal */}
                    <button 
                      onClick={() => setConfirmAction({ type: 'DELETE', policy })}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-slate-500">Severity:</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    policy.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 
                    policy.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : 
                    policy.severity === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' : 
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {policy.severity}
                  </span>
                </div>
              </div>
            ))}
            {policies.length === 0 && (
              <div className="text-center py-8 text-slate-500 text-sm">No policies configured.</div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              {confirmAction.type === 'DELETE' ? (
                <div className="p-2 bg-red-500/20 rounded-full text-red-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2 bg-cyan-500/20 rounded-full text-cyan-400">
                  <Info className="w-6 h-6" />
                </div>
              )}
              <h3 className="text-lg font-semibold text-white">
                {confirmAction.type === 'DELETE' 
                  ? 'Delete Policy' 
                  : `${confirmAction.policy.enabled ? 'Disable' : 'Enable'} Policy`}
              </h3>
            </div>
            
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              {confirmAction.type === 'DELETE' 
                ? <>Are you sure you want to permanently delete the rule <strong>"{confirmAction.policy.name}"</strong>? This action cannot be undone and it will be immediately removed from the security pipeline.</>
                : <>Are you sure you want to <strong>{confirmAction.policy.enabled ? 'disable' : 'enable'}</strong> the rule "{confirmAction.policy.name}"? </>
              }
            </p>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (confirmAction.type === 'DELETE') executeDeletePolicy(confirmAction.policy.id);
                  if (confirmAction.type === 'TOGGLE') executeTogglePolicy(confirmAction.policy.id);
                  setConfirmAction(null);
                }}
                className={`px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmAction.type === 'DELETE' 
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-cyan-600 hover:bg-cyan-500'
                }`}
              >
                {confirmAction.type === 'DELETE' ? 'Delete Permanently' : 'Confirm Change'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}