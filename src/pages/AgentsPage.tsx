import { useState } from 'react'
import type { AgentInfo } from '../lib/api'
import AgentGrid from '../components/agents/AgentGrid'
import AgentDetailPanel from '../components/agents/AgentDetailPanel'
import OrgChart from '../components/agents/OrgChart'
import { useToast } from '../hooks/useToast'

type ViewMode = 'tree' | 'grid'

const STORAGE_KEY = 'agents-view-mode'

function getInitialView(): ViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'grid' || stored === 'tree') return stored
  } catch { /* ignore */ }
  return 'tree'
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(getInitialView)
  const { push } = useToast()

  const switchView = (mode: ViewMode) => {
    setViewMode(mode)
    try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* ignore */ }
  }

  const handleSelectAgent = (agent: AgentInfo) => {
    setSelectedAgent(prev => prev?.id === agent.id ? null : agent)
  }

  return (
    <div className="h-full flex flex-col gap-4 min-w-0">
      <div className="mb-0 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Agent Command Center</h1>
        <div className="flex items-center gap-1 bg-bg-surface border border-border-subtle rounded-md p-0.5">
          <button
            onClick={() => switchView('tree')}
            className={`px-2.5 py-1 text-[12px] rounded transition-colors duration-100 ${
              viewMode === 'tree'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            🌳 Tree
          </button>
          <button
            onClick={() => switchView('grid')}
            className={`px-2.5 py-1 text-[12px] rounded transition-colors duration-100 ${
              viewMode === 'grid'
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            ▦ Grid
          </button>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        {viewMode === 'tree' ? (
          <OrgChart onSelectAgent={handleSelectAgent} />
        ) : (
          <AgentGrid onSelectAgent={handleSelectAgent} />
        )}
      </div>
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
