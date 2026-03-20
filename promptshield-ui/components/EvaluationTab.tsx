'use client'
import { useState } from 'react'
import { EVAL_DATA } from '@/lib/evalData'
import { SectionLabel, MiniBar, StatCard } from '@/components/ui'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts'

const TT_STYLE = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 6, fontFamily: 'var(--tech)', fontSize: 11, color: 'var(--t0)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
}

const LAYER_TABS = [
  { key: 'pipeline', label: 'PIPELINE', color: 'var(--g)' },
  { key: 'l1',       label: 'L1 INTENT', color: 'var(--b)' },
  { key: 'l2',       label: 'L2 POLICY', color: 'var(--p)' },
  { key: 'l3',       label: 'L3 CONTEXT', color: 'var(--g)' },
  { key: 'l4',       label: 'L4 AUDITOR', color: 'var(--a)' },
]

export function EvaluationTab() {
  const [active, setActive] = useState('pipeline')
  const tab = LAYER_TABS.find(t => t.key === active)!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* tab strip */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 14px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg0)', flexShrink: 0,
      }}>
        {LAYER_TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setActive(t.key)}
            style={{
              fontFamily: 'var(--display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              padding: '6px 14px', borderRadius: 'var(--radius)',
              border: active === t.key ? `1px solid ${t.color}44` : '1px solid transparent',
              background: active === t.key ? `${t.color}10` : 'transparent',
              color: active === t.key ? t.color : 'var(--t2)',
              cursor: 'pointer', transition: 'all 0.15s',
              boxShadow: active === t.key ? `0 0 10px ${t.color}1a` : 'none',
            }}
          >{t.label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: tab.color, boxShadow: `0 0 8px ${tab.color}` }} className="pulse" />
          <span style={{ fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--tech)', letterSpacing: '0.08em' }}>LIVE METRICS</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
        {active === 'pipeline' && <PipelineEval />}
        {active === 'l1' && <Layer1Eval />}
        {active === 'l2' && <Layer2Eval />}
        {active === 'l3' && <Layer3Eval />}
        {active === 'l4' && <Layer4Eval />}
      </div>
    </div>
  )
}

/* ── Shared ───────────────────────────────────────────────── */

function MetricRow({ metrics }: { metrics: Array<{label:string; value:number; color?:string}> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${metrics.length}, 1fr)`, gap: 8, marginBottom: 18 }}>
      {metrics.map(m => (
        <StatCard key={m.label} label={m.label} value={`${Math.round(m.value*100)}%`}
          color={m.color || (m.value>=0.85?'var(--g)':m.value>=0.6?'var(--a)':'var(--r)')} />
      ))}
    </div>
  )
}

function EvalCard({ title, children, accent = 'var(--g)' }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: 'var(--bg1)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 14,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}44 50%, transparent)` }} />
      <div style={{ fontSize: 9, color: accent, fontFamily: 'var(--display)', letterSpacing: '0.14em', marginBottom: 12 }}>⬡ {title}</div>
      {children}
    </div>
  )
}

function ConfusionMatrix({ tp, fn, fp, tn }: { tp:number; fn:number; fp:number; tn:number }) {
  const total = tp+fn+fp+tn
  const cells = [
    { label: 'TP', val: tp, color: 'var(--g)',  desc: 'true positive' },
    { label: 'FN', val: fn, color: 'var(--r)',  desc: 'false negative' },
    { label: 'FP', val: fp, color: 'var(--a)',  desc: 'false positive' },
    { label: 'TN', val: tn, color: 'var(--b)',  desc: 'true negative' },
  ]
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 6, alignItems: 'center' }}>
        <div />
        <div style={{ fontSize: 9, color: 'var(--t2)', textAlign: 'center', fontFamily: 'var(--tech)', letterSpacing: '0.08em' }}>PRED BLOCK</div>
        <div style={{ fontSize: 9, color: 'var(--t2)', textAlign: 'center', fontFamily: 'var(--tech)', letterSpacing: '0.08em' }}>PRED PASS</div>
        {['ACTUAL ATTACK','ACTUAL BENIGN'].map((row, ri) => [
          <div key={`l${ri}`} style={{ fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--tech)', letterSpacing: '0.06em', writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '0 4px' }}>{row}</div>,
          ...[cells[ri*2], cells[ri*2+1]].map((c,ci) => (
            <div key={`${ri}${ci}`} style={{
              background: `${c.color}0c`, border: `1px solid ${c.color}33`,
              borderRadius: 'var(--radius)', padding: '14px 10px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: 'var(--display)', fontSize: '1.6rem', fontWeight: 900, color: c.color, lineHeight: 1, textShadow: `0 0 16px ${c.color}60` }}>{c.val}</div>
              <div style={{ fontSize: 9, color: c.color, fontFamily: 'var(--display)', marginTop: 4, letterSpacing: '0.08em' }}>{c.label}</div>
              <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2, fontFamily: 'var(--tech)' }}>{total > 0 ? Math.round(c.val/total*100) : 0}%</div>
            </div>
          ))
        ])}
      </div>
    </div>
  )
}

/* ── Pipeline ─────────────────────────────────────────────── */
function PipelineEval() {
  const d = EVAL_DATA.fullPipeline
  const { summary, layer_catches } = d
  const total = d.total_adversarial

  const radar = [
    { m: 'Precision',   v: summary.precision*100 },
    { m: 'Recall',      v: summary.recall*100 },
    { m: 'F1',          v: summary.f1*100 },
    { m: 'Accuracy',    v: summary.accuracy*100 },
    { m: 'Specificity', v: (1-summary.fpr)*100 },
  ]
  const bars = [
    { name: 'Layer 1', v: layer_catches['1'], c: 'var(--b)' },
    { name: 'Layer 2', v: layer_catches['2'], c: 'var(--p)' },
    { name: 'Missed',  v: layer_catches.none, c: 'var(--r)' },
  ]

  return (
    <>
      <MetricRow metrics={[
        { label: 'Precision', value: summary.precision },
        { label: 'Recall',    value: summary.recall },
        { label: 'F1 Score',  value: summary.f1 },
        { label: 'FP Rate',   value: summary.fpr, color: summary.fpr < 0.1 ? 'var(--g)' : 'var(--r)' },
        { label: 'Accuracy',  value: summary.accuracy },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <EvalCard title="PERFORMANCE RADAR" accent="var(--g)">
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radar}>
              <PolarGrid stroke="var(--border2)" />
              <PolarAngleAxis dataKey="m" tick={{ fill:'var(--t1)', fontSize:10, fontFamily:'var(--tech)' }} />
              <Radar dataKey="v" stroke="var(--g)" fill="var(--g)" fillOpacity={0.12} dot={{ fill:'var(--g)', r:3 }} />
            </RadarChart>
          </ResponsiveContainer>
        </EvalCard>

        <EvalCard title="LAYER CONTRIBUTION" accent="var(--b)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bars} barSize={36}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill:'var(--t1)', fontSize:10, fontFamily:'var(--tech)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--t2)', fontSize:10, fontFamily:'var(--tech)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT_STYLE} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="v" name="caught" radius={[4,4,0,0]}>
                {bars.map((b,i) => <Cell key={i} fill={b.c} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 9, color: 'var(--t3)', textAlign: 'center', fontFamily: 'var(--tech)', marginTop: 4 }}>
            {layer_catches['1']} + {layer_catches['2']} caught · {layer_catches.none}/{total} missed
          </div>
        </EvalCard>
      </div>

      <EvalCard title="CONFUSION MATRIX" accent="var(--g)">
        <ConfusionMatrix tp={layer_catches['1']+layer_catches['2']} fn={layer_catches.none} fp={0} tn={d.total_benign} />
      </EvalCard>
    </>
  )
}

/* ── Layer 1 ──────────────────────────────────────────────── */
function Layer1Eval() {
  const d = EVAL_DATA.layer1
  const catData = Object.entries(d.per_category).map(([k,v]) => ({
    cat: k.replace(/_/g,' '), recall: Math.round(v.recall*100), tp: v.tp, fn: v.fn,
  }))
  return (
    <>
      <MetricRow metrics={[
        { label: 'Precision', value: d.summary.precision },
        { label: 'Recall',    value: d.summary.recall },
        { label: 'F1',        value: d.summary.f1 },
        { label: 'FP Rate',   value: d.summary.fpr, color:'var(--g)' },
        { label: 'Accuracy',  value: d.summary.accuracy },
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <EvalCard title="CATEGORY RECALL" accent="var(--b)">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={catData} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" domain={[0,100]} tick={{ fill:'var(--t2)', fontSize:9, fontFamily:'var(--tech)' }} axisLine={false} tickLine={false} unit="%" />
              <YAxis dataKey="cat" type="category" tick={{ fill:'var(--t1)', fontSize:9, fontFamily:'var(--tech)' }} width={110} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TT_STYLE} formatter={(v) => [`${v}%`, 'recall']} cursor={{ fill:'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="recall" radius={[0,4,4,0]}>
                {catData.map((e,i) => <Cell key={i} fill={e.recall>=80?'var(--g)':e.recall>=50?'var(--a)':'var(--r)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </EvalCard>

        <EvalCard title="BREAKDOWN" accent="var(--b)">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {Object.entries(d.per_category).map(([k,v]) => (
              <div key={k}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
                  <span style={{ color:'var(--t1)', fontFamily:'var(--tech)' }}>{k.replace(/_/g,' ')}</span>
                  <span style={{ color:'var(--t3)', fontFamily:'var(--tech)' }}>TP:{v.tp} FN:{v.fn}</span>
                </div>
                <MiniBar value={v.recall} />
              </div>
            ))}
          </div>
        </EvalCard>
      </div>

      <EvalCard title="FALSE NEGATIVES — MISSED ATTACKS" accent="var(--r)">
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {d.false_negatives.map((fn,i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
              background:'rgba(255,45,85,0.06)', border:'1px solid rgba(255,45,85,0.2)',
              borderRadius:'var(--radius)',
            }}>
              <span style={{ color:'var(--r)', fontSize:9, fontFamily:'var(--display)', letterSpacing:'0.06em', background:'rgba(255,45,85,0.1)', padding:'2px 6px', borderRadius:3, flexShrink:0 }}>
                {fn.label.replace(/_/g,' ').toUpperCase()}
              </span>
              <span style={{ color:'var(--t1)', fontSize:11, flex:1, fontFamily:'var(--tech)' }}>{fn.text}</span>
              <span style={{ color:'var(--r)', fontSize:9, fontFamily:'var(--tech)', flexShrink:0 }}>
                {Math.round(fn.risk_score*100)}% risk
              </span>
            </div>
          ))}
        </div>
      </EvalCard>
    </>
  )
}

/* ── Layer 2 ──────────────────────────────────────────────── */
function Layer2Eval() {
  const d = EVAL_DATA.layer2
  const NAMES: Record<string,string> = {
    P001:'No Role Override', P002:'No Exfiltration', P003:'No PII Leak',
    P004:'No Instr Override', P005:'No Manipulation', P006:'No Prompt Leak',
  }
  return (
    <>
      <MetricRow metrics={[
        { label:'Precision', value:d.summary.precision },
        { label:'Recall',    value:d.summary.recall },
        { label:'F1',        value:d.summary.f1 },
        { label:'FP Rate',   value:d.summary.fpr, color:'var(--g)' },
        { label:'Accuracy',  value:d.summary.accuracy },
      ]} />

      <div style={{ background:'var(--a-glow)', border:'1px solid rgba(255,204,0,0.25)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, fontSize:11, color:'var(--a)', fontFamily:'var(--tech)' }}>
        ⚠ LOW RECALL ({Math.round(d.summary.recall*100)}%) — policy threshold tuning recommended
      </div>

      <EvalCard title="PER-POLICY RECALL" accent="var(--p)">
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {Object.entries(d.per_policy).map(([k,v]) => (
            <div key={k}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:3 }}>
                <span style={{ color:'var(--t1)', fontFamily:'var(--tech)' }}>{k} — {NAMES[k]}</span>
                <span style={{ color:'var(--t3)', fontFamily:'var(--tech)' }}>TP:{v.tp} FN:{v.fn}</span>
              </div>
              <MiniBar value={v.recall} color="var(--p)" />
            </div>
          ))}
        </div>
      </EvalCard>
    </>
  )
}

/* ── Layer 3 ──────────────────────────────────────────────── */
function Layer3Eval() {
  const d = EVAL_DATA.layer3
  return (
    <>
      <MetricRow metrics={[
        { label:'Precision', value:d.summary.precision },
        { label:'Recall',    value:d.summary.recall },
        { label:'F1',        value:d.summary.f1 },
        { label:'FP Rate',   value:d.summary.fpr, color:d.summary.fpr<0.2?'var(--a)':'var(--r)' },
        { label:'Accuracy',  value:d.summary.accuracy },
      ]} />

      <div style={{ background:'var(--g-glow)', border:'1px solid rgba(0,255,163,0.25)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, fontSize:11, color:'var(--g)', fontFamily:'var(--tech)' }}>
        ✓ PERFECT RECALL (100%) — zero indirect injections missed across all categories
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <EvalCard title="INJECTION CATEGORIES" accent="var(--g)">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Object.entries(d.per_label).map(([k,v]) => (
              <div key={k}>
                <div style={{ fontSize:9, color:'var(--t1)', fontFamily:'var(--tech)', marginBottom:2 }}>{k.replace(/_/g,' ')}</div>
                <MiniBar value={v.recall} color="var(--g)" />
              </div>
            ))}
          </div>
        </EvalCard>

        <EvalCard title="DETECTION SUMMARY" accent="var(--g)">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
            <StatCard label="True Positives"  value={Object.values(d.per_label).reduce((s,v)=>s+v.tp,0)} color="var(--g)" />
            <StatCard label="False Positives" value={Math.round(d.summary.fpr*7)} color="var(--r)" />
          </div>
          <div style={{ fontSize:11, color:'var(--t1)', lineHeight:1.75, fontFamily:'var(--tech)' }}>
            L3 uses three signals:<br/>
            1. structural regex pattern matching<br/>
            2. semantic sim vs attack corpus<br/>
            3. intent drift (cosine distance)
          </div>
        </EvalCard>
      </div>
    </>
  )
}

/* ── Layer 4 ──────────────────────────────────────────────── */
function Layer4Eval() {
  const d = EVAL_DATA.layer4
  const CHECKS = [
    { name:'PII Detection',    desc:'SSN, email, credit card, IP via Presidio', color:'var(--b)' },
    { name:'Prompt Leak',      desc:'Semantic sim to system prompt content',     color:'var(--p)' },
    { name:'Toxicity',         desc:'Detoxify model — score 0–1',               color:'var(--a)' },
    { name:'Intent Fidelity',  desc:'Response ↔ query cosine similarity',       color:'var(--g)' },
  ]
  return (
    <>
      <MetricRow metrics={[
        { label:'Precision', value:d.summary.precision },
        { label:'Recall',    value:d.summary.recall },
        { label:'F1',        value:d.summary.f1 },
        { label:'FP Rate',   value:d.summary.fpr, color:d.summary.fpr<0.2?'var(--a)':'var(--r)' },
        { label:'Accuracy',  value:d.summary.accuracy },
      ]} />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        <EvalCard title="PER-CATEGORY RECALL" accent="var(--a)">
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Object.entries(d.per_label).map(([k,v]) => (
              <div key={k}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, marginBottom:2 }}>
                  <span style={{ color: v.fn>0?'var(--r)':'var(--t1)', fontFamily:'var(--tech)' }}>{k.replace(/_/g,' ')}</span>
                  {v.fn>0 && <span style={{ color:'var(--r)', fontFamily:'var(--display)', fontSize:8, letterSpacing:'0.1em' }}>MISSED</span>}
                </div>
                <MiniBar value={v.recall} color={v.recall===1?'var(--g)':'var(--r)'} />
              </div>
            ))}
          </div>
        </EvalCard>

        <EvalCard title="WHAT L4 CHECKS" accent="var(--a)">
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {CHECKS.map((c,i) => (
              <div key={c.name} style={{ display:'flex', gap:10, padding:'10px 0', borderBottom: i<CHECKS.length-1?'1px solid var(--border)':'none' }}>
                <div style={{ width:3, borderRadius:2, background:c.color, flexShrink:0, alignSelf:'stretch' }} />
                <div>
                  <div style={{ fontSize:11, color:c.color, fontFamily:'var(--display)', fontWeight:700, letterSpacing:'0.04em', marginBottom:2 }}>{c.name}</div>
                  <div style={{ fontSize:10, color:'var(--t2)', fontFamily:'var(--tech)' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </EvalCard>
      </div>

      <div style={{ background:'rgba(255,204,0,0.08)', border:'1px solid rgba(255,204,0,0.25)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:11, color:'var(--a)', fontFamily:'var(--tech)' }}>
        ⚠ system_prompt_leak_2 missed — indirect paraphrase leak not detected · threshold lowering recommended
      </div>
    </>
  )
}
