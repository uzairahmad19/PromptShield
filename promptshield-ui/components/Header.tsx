'use client'
import { useEffect, useState } from 'react'
import { healthCheck } from '@/lib/api'

const TABS = [
  { id: 'demo',       label: 'DEMO',       icon: '▶' },
  { id: 'evaluation', label: 'EVALUATION', icon: '◈' },
  { id: 'about',      label: 'ABOUT',      icon: '◉' },
]

export function Header({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  const [online, setOnline] = useState(false)
  const [timeStr, setTimeStr] = useState('--:--:--')   // stable SSR value
  const [mounted, setMounted] = useState(false)

  // Mark mounted — only then start ticking (avoids SSR/client mismatch)
  useEffect(() => {
    setMounted(true)
    const fmt = () => {
      const n = new Date()
      setTimeStr([n.getHours(), n.getMinutes(), n.getSeconds()].map(v => String(v).padStart(2, '0')).join(':'))
    }
    fmt()
    const id = setInterval(fmt, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const check = () => healthCheck().then(setOnline)
    check()
    const id = setInterval(check, 8000)
    return () => clearInterval(id)
  }, [])

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(3,7,16,0.95)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border2)',
      display: 'flex', alignItems: 'center',
      height: 52, padding: '0 20px', gap: 0,
      flexShrink: 0,
    }}>
      {/* top edge glow */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,255,163,0.4) 30%, rgba(0,200,255,0.3) 70%, transparent)' }} />

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginRight: 32 }}>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <polygon points="14,2 25,8 25,20 14,26 3,20 3,8" fill="none" stroke="rgba(0,255,163,0.5)" strokeWidth="1" />
          <polygon points="14,6 21,10 21,18 14,22 7,18 7,10" fill="rgba(0,255,163,0.08)" stroke="rgba(0,255,163,0.8)" strokeWidth="1" />
          <text x="14" y="16" textAnchor="middle" fill="var(--g)" fontSize="7" fontFamily="var(--display)" fontWeight="700">PS</text>
        </svg>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 13, color: 'var(--g)', letterSpacing: '0.08em', lineHeight: 1, textShadow: '0 0 16px rgba(0,255,163,0.4)' }} className="flicker">
            PROMPTSHIELD
          </div>
          <div style={{ fontSize: 8, color: 'var(--t2)', letterSpacing: '0.16em', fontFamily: 'var(--tech)', marginTop: 1 }}>
            THREAT DETECTION FOR LLMs
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 28, background: 'var(--border2)', marginRight: 24 }} />

      {/* Nav */}
      <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            style={{
              fontFamily: 'var(--display)', fontSize: 10, fontWeight: 700,
              letterSpacing: '0.1em', padding: '6px 16px',
              border: activeTab === t.id ? '1px solid rgba(0,255,163,0.3)' : '1px solid transparent',
              borderRadius: 'var(--radius)',
              background: activeTab === t.id ? 'linear-gradient(135deg, rgba(0,255,163,0.12), rgba(0,255,163,0.05))' : 'transparent',
              color: activeTab === t.id ? 'var(--g)' : 'var(--t2)',
              cursor: 'pointer', transition: 'all 0.18s',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: activeTab === t.id ? '0 0 12px rgba(0,255,163,0.12)' : 'none',
            }}
          >
            <span style={{ fontSize: 9 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Right status cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        {/* Clock — only shown after mount to avoid hydration mismatch */}
        <span style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--tech)', letterSpacing: '0.08em', minWidth: 60, textAlign: 'right' }}>
          {mounted ? timeStr : ''}
        </span>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        {/* API status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: mounted && online ? 'var(--g)' : 'var(--r)',
            boxShadow: mounted && online ? '0 0 8px var(--g)' : '0 0 8px var(--r)',
          }} className="pulse" />
          <span style={{ fontSize: 10, color: mounted && online ? 'var(--g1)' : 'var(--r)', fontFamily: 'var(--tech)', letterSpacing: '0.06em' }}>
            {mounted ? (online ? 'BACKEND ONLINE' : 'BACKEND OFFLINE') : 'CHECKING…'}
          </span>
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

        <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--tech)', letterSpacing: '0.06em' }}>
          JAMIA HAMDARD
        </span>
      </div>
    </header>
  )
}
