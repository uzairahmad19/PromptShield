import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PromptShield — Multi-Layer LLM Security',
  description: 'Semantic guardrail system for agentic LLM pipelines — Jamia Hamdard B.Tech Project',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
