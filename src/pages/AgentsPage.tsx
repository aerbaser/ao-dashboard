import { useState } from 'react'
import type { AgentInfo } from '../lib/api'
import AgentGrid from '../components/agents/AgentGrid'
import AgentDetail from '../components/agents/AgentDetail'
import { useToast } from '../hooks/useToast'

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const { push } = useToast()

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 relative min-w-0">
      <div className={selectedAgent ? 'flex-1 min-w-0' : 'flex-1 min-w-0'}>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text-primary">Agent Command Center</h1>
        </div>
        <AgentGrid onSelectAgent={setSelectedAgent} />
      </div>
      {selectedAgent && (
        <div className="w-full lg:w-[420px] lg:shrink-0 overflow-auto">
          <AgentDetail
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
            onToast={(payload) => push(payload)}
          />
        </div>
      )}
    </div>
  )
}
