const DEFAULT_BASE = 'http://localhost:5000'

function base() {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('ps_api_url') || DEFAULT_BASE).replace(/\/$/, '')
  }
  return DEFAULT_BASE
}

async function post<T>(path: string, body: Record<string, string>, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(tid)
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'API error')
    return json.data as T
  } catch (e) {
    clearTimeout(tid)
    throw e
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${base()}/health`, { signal: AbortSignal.timeout(3000) })
    const j = await res.json()
    return j.success === true
  } catch { return false }
}

export async function analyze(query: string) {
  return post<AnalyzeResult>('/analyze', { query }, 180000)
}

export async function checkLayer1(query: string) {
  return post<Layer1Result>('/layer1', { query })
}

export async function checkLayer2(query: string) {
  return post<Layer2Result>('/layer2', { query })
}

export async function checkLayer3(tool_output: string, tool_name: string, original_query: string) {
  return post<Layer3Result>('/layer3', { tool_output, tool_name, original_query })
}

export async function checkLayer4(response: string, original_query: string) {
  return post<Layer4Result>('/layer4', { response, original_query })
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface AnalyzeResult {
  output: string
  blocked: boolean
  blocked_at_layer: number | null
  audit_session: string
  layer_results: {
    layer1?: Layer1Result
    layer2?: Layer2Result
    layer3?: Layer3ResultItem[]
    layer4?: Layer4Result
  }
  elapsed_seconds: number
}

export interface Layer1Result {
  decision: 'BLOCK' | 'PASS'
  risk_score: number
  faiss_score: number
  nli_score: number
  top_attack_match: string
  top_attack_label: string
  reason: string
  top_k_matches?: Array<{ text: string; score: number; label: string }>
  elapsed_seconds?: number
}

export interface Layer2Result {
  decision: 'BLOCK' | 'PASS'
  violation_score: number
  violated_policy_id: string
  violated_policy_name: string
  violated_policy_severity: string
  closest_example: string
  reason: string
  all_policy_scores?: Record<string, number>
  elapsed_seconds?: number
}

export interface Layer3Result {
  decision: 'PASS' | 'FLAG' | 'SANITIZE' | 'BLOCK'
  semantic_score: number
  drift_score: number
  structural_hits: string[]
  sanitized_output: string
  reason: string
  elapsed_seconds?: number
}

export interface Layer3ResultItem {
  tool: string
  decision: string
  semantic_score: number
  drift_score: number
  structural_hits: number
  reason: string
}

export interface Layer4Result {
  decision: 'PASS' | 'FLAG' | 'REDACT' | 'BLOCK'
  pii_found: boolean
  pii_entities: string[]
  leak_score: number
  fidelity_score: number
  toxicity_score: number
  flags: string[]
  final_response: string
  was_modified: boolean
  reason: string
  elapsed_seconds?: number
}
