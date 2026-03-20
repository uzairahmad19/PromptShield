'use client'
import { SectionLabel } from '@/components/ui'

const LAYERS = [
  { num:1, color:'var(--b)',  name:'Intent Classifier', tag:'FAISS + NLI', desc:'all-MiniLM-L6-v2 embeddings searched against 42 attack vectors from HackAPrompt (600k) and TensorTrust (126k). Zero-shot NLI provides a second opinion via facebook/bart-large-mnli. Combined risk = max(faiss, nli×0.9). Threshold 0.7.' },
  { num:2, color:'var(--p)',  name:'Semantic Policy Checker', tag:'Embeddings', desc:'27 policy embeddings across 6 categories (role override, PII exfil, data theft, instruction override, manipulation, prompt disclosure). Threshold-based blocking with configurable severity. Threshold 0.68.' },
  { num:3, color:'var(--g)',  name:'Context Integrity Checker', tag:'Novel', desc:'Inspects every tool output in real-time. Three signals: structural regex (injection markers), semantic similarity (attack corpus), intent drift (cosine distance between tool output and original query). Sanitises or blocks before LLM sees output.' },
  { num:4, color:'var(--a)',  name:'Response Auditor', tag:'PII + Toxicity', desc:'Final gate: Presidio PII detection (SSN, CC, email, phone, IP), system prompt leak via semantic similarity, Detoxify toxicity scoring, intent fidelity check. Redacts PII and blocks leaked or toxic responses.' },
]

const STACK = [
  { cat:'Backend', items:['Python 3.11', 'Flask', 'LangChain', 'Ollama (llama3.2)'] },
  { cat:'ML',      items:['FAISS', 'sentence-transformers', 'facebook/bart-large-mnli', 'Detoxify'] },
  { cat:'NLP',     items:['Presidio', 'spaCy', 'DuckDuckGo Search'] },
  { cat:'Frontend', items:['Next.js 15', 'TypeScript', 'Recharts', 'IBM Plex Mono', 'Orbitron'] },
]

export function AboutTab() {
  return (
    <div style={{ overflowY:'auto', height:'100%', padding:'14px'}}>
      {/* Hero */}
      <div style={{
        background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)',
        padding:'24px 28px', marginBottom:20, position:'relative', overflow:'hidden',
      }}>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg, transparent, var(--g)55 40%, var(--b)44 70%, transparent)' }} />
        {/* corner brackets */}
        {[{s:{top:8,left:8,borderWidth:'2px 0 0 2px'}},{s:{top:8,right:8,borderWidth:'2px 2px 0 0'}},{s:{bottom:8,left:8,borderWidth:'0 0 2px 2px'}},{s:{bottom:8,right:8,borderWidth:'0 2px 2px 0'}}].map((c,i)=>(
          <div key={i} style={{ position:'absolute', width:14, height:14, borderColor:'var(--g2)', borderStyle:'solid', opacity:0.4, ...c.s }} />
        ))}
        <div style={{ fontFamily:'var(--display)', fontSize:22, fontWeight:900, color:'var(--g)', letterSpacing:'0.04em', marginBottom:6, textShadow:'0 0 30px rgba(0,255,163,0.3)' }}>
          PROMPTSHIELD
        </div>
        <div style={{ fontSize:11, color:'var(--t2)', fontFamily:'var(--tech)', letterSpacing:'0.1em', marginBottom:16 }}>
          MULTI-LAYER SEMANTIC GUARDRAIL SYSTEM FOR AGENTIC LLM PIPELINES
        </div>
        <p style={{ fontSize:12, color:'var(--t1)', lineHeight:1.85, maxWidth:660, fontFamily:'var(--tech)' }}>
          Detects both <span style={{ color:'var(--r)' }}>direct prompt injection</span> (malicious user input) and{' '}
          <span style={{ color:'var(--a)' }}>indirect injection via tool outputs</span> (poisoned web results, files, databases)
          — before the LLM processes them and before its responses reach the user.
        </p>
      </div>

      <SectionLabel>Architecture</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
        {LAYERS.map((l,i) => (
          <div key={l.num} className="fade-up" style={{
            animationDelay:`${i*60}ms`,
            background:'var(--bg1)', border:`1px solid ${l.color}28`, borderRadius:'var(--radius-lg)',
            borderLeft:`3px solid ${l.color}`, padding:'14px 18px', position:'relative', overflow:'hidden',
          }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:1, background:`linear-gradient(90deg, ${l.color}40, transparent 60%)` }} />
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <div style={{
                width:30, height:30, borderRadius:6,
                background:`${l.color}12`, border:`1px solid ${l.color}33`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--display)', fontSize:10, fontWeight:900, color:l.color, flexShrink:0,
              }}>L{l.num}</div>
              <span style={{ fontFamily:'var(--display)', fontSize:12, color:l.color, letterSpacing:'0.05em', fontWeight:700 }}>{l.name}</span>
              <span style={{ fontSize:9, color:'var(--t3)', background:'var(--bg3)', padding:'2px 7px', borderRadius:3, fontFamily:'var(--tech)' }}>{l.tag}</span>
            </div>
            <p style={{ fontSize:11, color:'var(--t1)', lineHeight:1.75, fontFamily:'var(--tech)' }}>{l.desc}</p>
          </div>
        ))}
      </div>

      <SectionLabel>Datasets</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
        {[
          { name:'HackAPrompt', count:'~600k', desc:'Adversarial prompts targeting AI safety. Used for L1 attack corpus and L2 policy examples.', color:'var(--r)' },
          { name:'TensorTrust',  count:'~126k', desc:'Live prompt injection attack/defense pairs. Used to evaluate and improve L1 robustness.', color:'var(--a)' },
        ].map(d => (
          <div key={d.name} style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
              <span style={{ fontFamily:'var(--display)', fontWeight:700, fontSize:13, color:d.color, letterSpacing:'0.04em' }}>{d.name}</span>
              <span style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--tech)' }}>{d.count} samples</span>
            </div>
            <p style={{ fontSize:11, color:'var(--t1)', lineHeight:1.7, fontFamily:'var(--tech)' }}>{d.desc}</p>
          </div>
        ))}
      </div>

      <SectionLabel>Technology Stack</SectionLabel>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:20 }}>
        {STACK.map(s => (
          <div key={s.cat} style={{ background:'var(--bg1)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'12px 14px' }}>
            <div style={{ fontSize:9, color:'var(--g2)', fontFamily:'var(--display)', letterSpacing:'0.14em', marginBottom:8 }}>{s.cat.toUpperCase()}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {s.items.map(t => (
                <span key={t} style={{ fontSize:10, padding:'3px 9px', borderRadius:4, background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--t1)', fontFamily:'var(--tech)' }}>{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize:10, color:'var(--t3)', fontFamily:'var(--tech)', letterSpacing:'0.06em', textAlign:'center', padding:'8px 0' }}>
        B.Tech Final Year Project · Jamia Hamdard · 2025–26
      </div>
    </div>
  )
}
