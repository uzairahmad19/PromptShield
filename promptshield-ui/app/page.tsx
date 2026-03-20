'use client'
import { useState, useCallback } from 'react'
import { Header } from '@/components/Header'
import { Terminal, LogEntry, createLog } from '@/components/Terminal'
import { DemoTab } from '@/components/DemoTab'
import { EvaluationTab } from '@/components/EvaluationTab'
import { AboutTab } from '@/components/AboutTab'

export default function Home() {
  const [activeTab, setActiveTab] = useState('demo')
  const [logs, setLogs] = useState<LogEntry[]>([
    createLog('PromptShield v1.0.0 — system initialised', 'ok'),
    createLog('4 detection layers armed', 'dim'),
    createLog('awaiting input…', 'dim'),
  ])

  const addLogs = useCallback((newLogs: LogEntry[]) => {
    setLogs(prev => [...prev.slice(-200), ...newLogs])
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative', zIndex: 1, overflow: 'hidden' }}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {activeTab === 'demo'       && <DemoTab addLogs={addLogs} />}
          {activeTab === 'evaluation' && <EvaluationTab />}
          {activeTab === 'about'      && <AboutTab />}
        </div>
        <Terminal logs={logs} />
      </div>
    </div>
  )
}
