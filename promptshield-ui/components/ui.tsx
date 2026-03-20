'use client'
import { ReactNode } from 'react'

const decide = (d = '') => {
  const u = d.toUpperCase()
  if (u.includes('BLOCK'))    return 'block'
  if (u.includes('SANITIZE') || u.includes('REDACT')) return 'sanitize'
  if (u.includes('FLAG'))     return 'flag'
  if (u.includes('PASS') || u.includes('ALLOW') || u.includes('OK')) return 'pass'
  return 'unknown'
}

const DECISION_STYLES = {
  block:    { bg: 'rgba(255,45,85,0.12)',   color: 'var(--r)',  border: 'rgba(255,45,85,0.4)',   icon: '■' },
  sanitize: { bg: 'rgba(255,204,0,0.1)',    color: 'var(--a)',  border: 'rgba(255,204,0,0.35)',  icon: '◆' },
  flag:     { bg: 'rgba(0,200,255,0.1)',    color: 'var(--b)',  border: 'rgba(0,200,255,0.35)',  icon: '▲' },
  pass:     { bg: 'rgba(0,255,163,0.08)',   color: 'var(--g)',  border: 'rgba(0,255,163,0.3)',   icon: '●' },
  unknown:  { bg: 'rgba(255,255,255,0.04)', color: 'var(--t1)', border: 'rgba(255,255,255,0.1)', icon: '○' },
}

export function DecisionBadge({ decision }: { decision?: string }) {
  const s = DECISION_STYLES[decide(decision)]
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      borderRadius: 4, padding: '2px 9px',
      fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
      fontFamily: 'var(--display)', textTransform: 'uppercase',
      display: 'inline-flex', alignItems: 'center', gap: 5,
    }}>
      <span style={{ fontSize: 6 }}>{s.icon}</span>
      {(decision || 'UNKNOWN').toUpperCase()}
    </span>
  )
}

export function ScoreBar({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  const color = value > 0.7 ? 'var(--r)' : value > 0.4 ? 'var(--a)' : 'var(--g)'
  const shadow = value > 0.7 ? 'rgba(255,45,85,0.4)' : value > 0.4 ? 'rgba(255,204,0,0.3)' : 'rgba(0,255,163,0.3)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
      <span style={{ color: 'var(--t2)', fontSize: 10, width: 116, flexShrink: 0, fontFamily: 'var(--tech)', letterSpacing: '0.04em' }}>{label}</span>
      <div style={{ flex: 1, height: 3, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div
          className="score-bar"
          style={{
            height: '100%', width: `${pct}%`, borderRadius: 2,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            boxShadow: `0 0 8px ${shadow}`,
            animationDelay: `${delay}ms`,
          }}
        />
      </div>
      <span style={{ color, fontSize: 11, width: 34, textAlign: 'right', fontFamily: 'var(--tech)', fontWeight: 600 }}>{pct}%</span>
    </div>
  )
}

export function LayerCard({ num, name, decision, children, delay = 0 }: {
  num: number; name: string; decision?: string; children?: ReactNode; delay?: number
}) {
  const kind = decide(decision)
  const s = DECISION_STYLES[kind]
  const accentColor = kind === 'pass' ? 'var(--g2)' : kind === 'block' ? 'var(--r1)' : kind === 'sanitize' ? 'var(--a1)' : 'var(--b1)'

  return (
    <div className="card fade-up" style={{ animationDelay: `${delay}ms`, borderColor: `${s.border}` }}>
      {/* top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${s.color}55 50%, transparent)` }} />
      {/* corner brackets */}
      {['tl','tr','bl','br'].map(c => (
        <div key={c} style={{
          position: 'absolute',
          width: 9, height: 9,
          borderColor: accentColor,
          borderStyle: 'solid',
          opacity: 0.5,
          ...(c === 'tl' ? { top: 5, left: 5, borderWidth: '1px 0 0 1px' } :
              c === 'tr' ? { top: 5, right: 5, borderWidth: '1px 1px 0 0' } :
              c === 'bl' ? { bottom: 5, left: 5, borderWidth: '0 0 1px 1px' } :
                           { bottom: 5, right: 5, borderWidth: '0 1px 1px 0' }),
        }} />
      ))}

      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--display)', fontSize: 10, fontWeight: 700,
            background: s.bg, color: s.color, border: `1px solid ${s.border}`, flexShrink: 0,
          }}>L{num}</div>
          <span style={{ color: 'var(--t0)', fontSize: 12, fontFamily: 'var(--tech)', letterSpacing: '0.05em' }}>{name}</span>
          {decision && <div style={{ marginLeft: 'auto' }}><DecisionBadge decision={decision} /></div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  const c = color || 'var(--t0)'
  return (
    <div className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${c}33 50%, transparent)` }} />
      <div style={{ fontFamily: 'var(--display)', fontSize: '1.5rem', fontWeight: 900, color: c, lineHeight: 1, textShadow: `0 0 20px ${c}60` }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--t2)', marginTop: 5, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--tech)' }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--t1)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 8 }}>
      <span style={{ fontSize: 9, color: 'var(--g2)', letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'var(--display)', whiteSpace: 'nowrap' }}>
        ⬡ {children}
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border2), transparent)' }} />
    </div>
  )
}

export function Reason({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, color: 'var(--t1)', fontFamily: 'var(--tech)',
      borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8,
      lineHeight: 1.6, letterSpacing: '0.02em',
    }}>
      <span style={{ color: 'var(--t2)', marginRight: 6 }}>//</span>{text}
    </div>
  )
}

export function MiniBar({ value, label, color }: { value: number; label?: string; color?: string }) {
  const pct = Math.round(value * 100)
  const c = color || (value >= 0.8 ? 'var(--g)' : value >= 0.5 ? 'var(--a)' : 'var(--r)')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {label && <span style={{ fontSize: 10, color: 'var(--t2)', width: 96, flexShrink: 0, fontFamily: 'var(--tech)' }}>{label}</span>}
      <div style={{ flex: 1, height: 5, background: 'var(--bg3)', borderRadius: 2, overflow: 'hidden' }}>
        <div className="score-bar" style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${c}88, ${c})`, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color: c, width: 32, textAlign: 'right', fontFamily: 'var(--tech)', fontWeight: 600 }}>{pct}%</span>
    </div>
  )
}

export function Spinner({ text }: { text?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--t1)', fontSize: 12, padding: '20px 0', fontFamily: 'var(--tech)' }}>
      <div className="spin" style={{ width: 18, height: 18, border: '2px solid var(--border2)', borderTopColor: 'var(--g)', borderRadius: '50%', boxShadow: '0 0 8px rgba(0,255,163,0.2)' }} />
      <span style={{ letterSpacing: '0.05em' }}>{text || 'PROCESSING…'}</span>
      <span className="pulse" style={{ color: 'var(--g)', fontSize: 8 }}>●●●</span>
    </div>
  )
}

export function ThreatBanner({ blocked, decision, reason, elapsed }: { blocked: boolean; decision: string; reason?: string; elapsed?: number }) {
  const s = DECISION_STYLES[decide(decision)]
  return (
    <div className="fade-up card" style={{
      borderColor: s.border,
      background: `linear-gradient(135deg, ${s.bg}, var(--bg1))`,
      padding: '16px 18px',
      display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16,
    }}>
      {/* pulsing icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: s.bg, border: `1px solid ${s.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, color: s.color,
      }} className={blocked ? 'pulse' : ''}>
        {blocked ? '⚠' : '✓'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 13, fontWeight: 700, color: s.color, letterSpacing: '0.06em' }}>
            {decision}
          </span>
          {elapsed && <span style={{ fontSize: 10, color: 'var(--t2)', fontFamily: 'var(--tech)' }}>{elapsed}ms</span>}
        </div>
        {reason && (
          <div style={{ fontSize: 11, color: 'var(--t1)', lineHeight: 1.6, fontFamily: 'var(--tech)', wordBreak: 'break-word' }}>
            {reason.substring(0, 220)}
          </div>
        )}
      </div>
      {/* glow line bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${s.color}44 50%, transparent)` }} />
    </div>
  )
}
