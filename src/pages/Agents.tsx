import { useState } from 'react'
import type { AgentInfo } from '../lib/api'
import AgentGrid from '../components/agents/AgentGrid'
import AgentDetail from '../components/agents/AgentDetail'

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Topbar */}
      <header className="h-12 border-b border-border-subtle bg-bg-base flex items-center px-4">
        <span className="text-[14px] font-semibold text-text-primary">AO Dashboard</span>
        <span className="mx-2 text-text-disabled">/</span>
        <span className="text-[13px] text-accent-amber">Agents</span>
      </header>

      {/* Content */}
      <main className="max-w-[1280px] mx-auto px-4 py-6">
        <h1 className="text-[18px] font-semibold text-text-primary mb-4">Agent Command Center</h1>
        <AgentGrid onSelectAgent={setSelectedAgent} />
      </main>

      {/* Detail panel */}
      {selectedAgent && (
        <AgentDetail
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[60] bg-bg-elevated border border-border-default rounded-md px-4 py-2 text-[12px] text-text-primary shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}
