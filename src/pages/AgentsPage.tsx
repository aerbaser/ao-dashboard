import { useState } from 'react'
import type { AgentInfo } from '../lib/api'
import AgentGrid from '../components/agents/AgentGrid'
import AgentDetailPanel from '../components/agents/AgentDetailPanel'
import { useToast } from '../hooks/useToast'

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const { push } = useToast()

  const handleSelectAgent = (agent: AgentInfo) => {
    // Toggle: clicking same agent closes the panel
    setSelectedAgent(prev => prev?.id === agent.id ? null : agent)
  }

  return (
    <div className="h-full flex flex-col gap-4 min-w-0">
      <div className="mb-0 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Agent Command Center</h1>
      </div>
      <AgentGrid onSelectAgent={handleSelectAgent} />
      {selectedAgent && (
        <AgentDetailPanel
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onToast={(payload) => push(payload)}
        />
      )}
    </div>
  )
}
