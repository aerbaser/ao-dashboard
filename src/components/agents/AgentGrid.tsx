import { useState, useEffect, useCallback } from 'react'
import type { AgentInfo } from '../../lib/api'
import { fetchAgents } from '../../lib/api'
import AgentCard from './AgentCard'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'

interface AgentGridProps {
  onSelectAgent: (agent: AgentInfo) => void
}

export default function AgentGrid({ onSelectAgent }: AgentGridProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await fetchAgents()
      setAgents(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  if (error && agents.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p className="text-accent-red">{error}</p>
        <button onClick={load} className="mt-2 text-[11px] text-accent-amber hover:underline">
          Retry
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <EmptyState icon="◎" title="No agents found" description="No active agent sessions" />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {agents.map(agent => (
        <AgentCard
          key={agent.id}
          agent={agent}
          onClick={() => onSelectAgent(agent)}
        />
      ))}
    </div>
  )
}
