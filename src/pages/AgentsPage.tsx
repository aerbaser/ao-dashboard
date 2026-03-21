import { useState } from 'react'
import type { AgentInfo } from '../lib/api'
import AgentGrid from '../components/agents/AgentGrid'
import AgentDetail from '../components/agents/AgentDetail'

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  return (
    <div className="h-full flex gap-4 relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-bg-elevated border border-border-default rounded-md px-3 py-2 text-sm text-text-primary font-mono shadow-lg">
          {toast}
        </div>
      )}
      <div className={selectedAgent ? 'w-80 shrink-0' : 'flex-1'}>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Agent Command Center</h1>
        </div>
        <AgentGrid onSelectAgent={setSelectedAgent} />
      </div>
      {selectedAgent && (
        <div className="flex-1 min-w-0">
          <AgentDetail
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
            onToast={(msg) => { setToast(msg); setTimeout(() => setToast(null), 3000) }}
          />
        </div>
      )}
    </div>
  )
}
