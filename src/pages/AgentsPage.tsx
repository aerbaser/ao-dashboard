import { useState } from 'react'
import type { AgentInfo } from '../lib/api'
import AgentGrid from '../components/agents/AgentGrid'
import AgentDetail from '../components/agents/AgentDetail'
import { useToast } from '../hooks/useToast'

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const { push } = useToast()

  return (
    <div className="h-full flex flex-col md:flex-row gap-4 relative min-w-0">
      <div className={selectedAgent ? 'w-full md:w-80 shrink-0' : 'flex-1 min-w-0'}>
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
            onToast={(msg) => push(msg, 'success')}
          />
        </div>
      )}
    </div>
  )
}
