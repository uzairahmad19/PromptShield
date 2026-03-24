'use client'
import { LogEntry } from '@/components/Terminal'
import { SectionLabel } from '@/components/ui'

interface LayersTabProps { addLogs: (logs: LogEntry[]) => void }

const LAYERS = [
  { num:1, label:'INTENT CLASSIFIER',   tag:'FAISS + NLI', color:'var(--b)',  threshold:'0.700', desc:'Embeds input via all-MiniLM-L6-v2, cosine-searches 42 attack vectors, combines with zero-shot NLI (bart-large-mnli). risk = max(faiss, nli×0.9).' },
  { num:2, label:'POLICY CHECKER',      tag:'EMBEDDINGS',  color:'var(--p)',  threshold:'0.680', desc:'Matches query against 27 policy violation embeddings across 6 categories. Configurable severity levels determine blocking behaviour.' },
  { num:3, label:'CONTEXT INTEGRITY',   tag:'NOVEL',       color:'var(--g)',  threshold:'0.600', desc:'Inspects each tool output for indirect injection via structural regex, semantic similarity, and intent drift detection. Sanitises or blocks before LLM sees output.' },
  { num:4, label:'RESPONSE AUDITOR',    tag:'PII+TOX',     color:'var(--a)',  threshold:'0.700', desc:'Final gate: Presidio PII detection, system-prompt leak scoring, Detoxify toxicity, intent fidelity check. Redacts or blocks unsafe responses.' },
]

const FLOW = [
  { id:'input',  label:'USER INPUT',         sub:'raw prompt',                     color:'var(--t1)' },
  null,
  { id:'l1',     label:'L1 · INTENT',        sub:'FAISS + NLI · block ≥ 0.700',   color:'var(--b)' },
  null,
  { id:'l2',     label:'L2 · POLICY',        sub:'embeddings · block ≥ 0.680',    color:'var(--p)' },
  null,
  { id:'agent',  label:'ReAct AGENT',        sub:'llama3.2 · tools: search / calc / file', color:'var(--t2)', dim:true },
  null,
  { id:'l3',     label:'L3 · CONTEXT',       sub:'per-tool injection scan',        color:'var(--g)' },
  null,
  { id:'l4',     label:'L4 · AUDITOR',       sub:'PII + toxicity + leak',          color:'var(--a)' },
  null,
  { id:'out',    label:'SAFE RESPONSE',      sub:'delivered to user',              color:'var(--g)' },
]

export function LayersTab({ addLogs }: LayersTabProps) {
  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>
      {/* Pipeline flow column */}
      <div style={{
        width:260, flexShrink:0, borderRight:'1px solid var(--border)',
        background:'var(--bg0)', padding:'14px 12px', overflowY:'auto',
        display:'flex', flexDirection:'column', alignItems:'stretch',
      }}>
        <div style={{ fontSize:9, color:'var(--g2)', fontFamily:'var(--display)', letterSpacing:'0.16em', marginBottom:14 }}>⬡ PIPELINE FLOW</div>
        {FLOW.map((node, i) => {
          if (!node) return (
            <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'3px 0' }}>
              <div style={{ width:1, height:8, background:'var(--border2)' }} />
              <div style={{ fontSize:9, color:'var(--border3)' }}>▼</div>
            </div>
          )
          return (
            <div key={node.id} style={{
              padding:'10px 12px', borderRadius:'var(--radius)',
              border:`1px solid ${node.color}30`,
              background: node.dim ? 'transparent' : `${node.color}08`,
              opacity: node.dim ? 0.5 : 1,
            }}>
              <div style={{ color:node.color, fontSize:10, fontFamily:'var(--display)', fontWeight:700, letterSpacing:'0.06em' }}>{node.label}</div>
              <div style={{ color:'var(--t3)', fontSize:9, fontFamily:'var(--tech)', marginTop:3 }}>{node.sub}</div>
            </div>
          )
        })}
      </div>

      {/* Right: layer details */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
        <SectionLabel>Layer Architecture</SectionLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
          {LAYERS.map((l, i) => (
            <div key={l.num} className="fade-up" style={{
              animationDelay:`${i*60}ms`,
              background:'var(--bg1)', borderRadius:'var(--radius-lg)',
              border:`1px solid ${l.color}28`,
              borderLeft:`3px solid ${l.color}`,
              padding:'14px 16px',
              position:'relative', overflow:'hidden',
            }}>
              <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg, ${l.color}44, transparent)` }} />
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{
                  width:32, height:32, borderRadius:6,
                  background:`${l.color}12`, border:`1px solid ${l.color}33`,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--display)', fontSize:11, fontWeight:900, color:l.color, flexShrink:0,
                }}>L{l.num}</div>
                <div>
                  <span style={{ fontFamily:'var(--display)', fontSize:12, fontWeight:700, color:l.color, letterSpacing:'0.06em' }}>{l.label}</span>
                  <span style={{ marginLeft:8, fontSize:9, color:'var(--t3)', background:'var(--bg3)', padding:'2px 7px', borderRadius:3, fontFamily:'var(--tech)' }}>{l.tag}</span>
                  <span style={{ marginLeft:6, fontSize:9, color:l.color, fontFamily:'var(--tech)' }}>block ≥ {l.threshold}</span>
                </div>
              </div>
              <p style={{ fontSize:11, color:'var(--t1)', lineHeight:1.75, fontFamily:'var(--tech)' }}>{l.desc}</p>
            </div>
          ))}
        </div>

        <SectionLabel>Decision Logic</SectionLabel>
        <div style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px', fontFamily:'var(--tech)', fontSize:11, lineHeight:2, color:'var(--t1)' }}>
          {[
            { pre:'L1', txt:' risk_score ≥ 0.700', suf:' → BLOCK (immediate return)', c:'var(--b)' },
            { pre:'L2', txt:' violation_score ≥ 0.680', suf:' → BLOCK (immediate return)', c:'var(--p)' },
            { pre:'AGENT', txt:' runs tools, collects intermediate_steps', suf:'', c:'var(--t2)' },
            { pre:'L3', txt:' per-tool: exfil | (struct_hits & high_sem)', suf:' → BLOCK', c:'var(--g)' },
            { pre:'   ', txt:' struct_hits | high_sem', suf:' → SANITIZE', c:'var(--g)' },
            { pre:'   ', txt:' low drift (non-exempt)', suf:' → FLAG', c:'var(--g)' },
            { pre:'L4', txt:' pii | leak | toxicity', suf:' → BLOCK / REDACT', c:'var(--a)' },
            { pre:'   ', txt:' all clear', suf:' → PASS — safe response delivered', c:'var(--g)' },
          ].map((l,i) => (
            <div key={i}>
              <span style={{ color:l.c, fontWeight:600 }}>{l.pre}</span>
              <span style={{ color:'var(--t2)' }}>{l.txt}</span>
              <span style={{ color:l.c }}>{l.suf}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
