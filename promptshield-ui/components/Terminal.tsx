'use client'
import { useEffect, useRef, useState } from 'react'

export interface LogEntry { ts: string; msg: string; type: 'info' | 'ok' | 'warn' | 'err' | 'dim' }

function ts() {
  const n = new Date()
  return [n.getHours(), n.getMinutes(), n.getSeconds()].map(v => String(v).padStart(2, '0')).join(':')
}

export function createLog(msg: string, type: LogEntry['type'] = 'dim'): LogEntry {
  return { ts: ts(), msg, type }
}

const COL: Record<string, string> = {
  info: 'var(--b)', ok: 'var(--g)', warn: 'var(--a)', err: 'var(--r)', dim: 'var(--t2)',
}
const PREFIX: Record<string, string> = {
  info: '→', ok: '✓', warn: '⚠', err: '✕', dim: '·',
}

export function Terminal({ logs }: { logs: LogEntry[] }) {
  const bodyRef = useRef<HTMLDivElement>(null)
  // cursorTs is only set after mount — avoids SSR/client timestamp mismatch
  const [cursorTs, setCursorTs] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCursorTs(ts())
    const id = setInterval(() => setCursorTs(ts()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [logs])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderLeft: '1px solid var(--border2)',
      background: 'var(--bg0)',
      height: '100%', overflow: 'hidden', position: 'relative',
    }}>
      {/* scanline sweep — purely decorative, no content so no hydration issue */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: '30%',
        background: 'linear-gradient(180deg, transparent, rgba(0,255,163,0.015), transparent)',
        animation: 'scan 6s linear infinite', pointerEvents: 'none', zIndex: 10,
      }} />

      {/* Header */}
      <div style={{
        padding: '9px 14px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg1)', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['var(--r)', 'var(--a)', 'var(--g)'].map((c, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
        </div>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 9, color: 'var(--t2)', fontFamily: 'var(--display)', letterSpacing: '0.12em' }}>
          AUDIT LOG
        </span>
        <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--tech)' }}>{logs.length} entries</span>
      </div>

      {/* Log body */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', fontSize: 11, lineHeight: 1.9 }}>
        {logs.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 1, fontFamily: 'var(--tech)' }}>
            <span style={{ color: 'var(--t3)', flexShrink: 0, fontSize: 10 }}>{l.ts}</span>
            <span style={{ color: COL[l.type], flexShrink: 0 }}>{PREFIX[l.type]}</span>
            <span style={{ color: COL[l.type], wordBreak: 'break-word', opacity: l.type === 'dim' ? 0.7 : 1 }}>{l.msg}</span>
          </div>
        ))}
        {/* blinking cursor — only rendered after mount so timestamp is stable */}
        {mounted && (
          <div style={{ display: 'flex', gap: 6, fontFamily: 'var(--tech)', fontSize: 11 }}>
            <span style={{ color: 'var(--t3)' }}>{cursorTs}</span>
            <span style={{ color: 'var(--g)' }} className="pulse">█</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border)', fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--tech)', flexShrink: 0 }}>
        <span style={{ color: 'var(--g)' }}>ps</span>
        <span style={{ color: 'var(--t2)' }}>@shield</span>
        <span style={{ color: 'var(--t3)' }}>:~$</span>
        <span style={{ color: 'var(--g)', marginLeft: 8 }} className="pulse">▌</span>
      </div>
    </div>
  )
}
