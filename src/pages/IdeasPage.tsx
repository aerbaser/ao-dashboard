import { usePolling } from '../hooks/usePolling'
import { getIdeas } from '../lib/api'
import IdeaCard from '../components/ideas/IdeaCard'
import IdeaForm from '../components/ideas/IdeaForm'
import type { IdeaStatus } from '../lib/types'

const STATUS_ORDER: IdeaStatus[] = [
  'brainstorming', 'artifact_ready', 'draft', 'approved', 'in_work', 'archived',
]

export default function IdeasPage() {
  const { data: ideas, loading, error, refetch } = usePolling(getIdeas, 5000)

  const sorted = ideas
    ? [...ideas].sort((a, b) => {
        const ai = STATUS_ORDER.indexOf(a.status)
        const bi = STATUS_ORDER.indexOf(b.status)
        if (ai !== bi) return ai - bi
        return b.updated_at.localeCompare(a.updated_at)
      })
    : []

  const brainstormingCount = sorted.filter(i => i.status === 'brainstorming').length

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">Ideas</h1>
          {brainstormingCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-subtle text-blue animate-pulse">
              {brainstormingCount} thinking
            </span>
          )}
        </div>
        {ideas && (
          <span className="text-xs text-text-tertiary">{ideas.length} ideas</span>
        )}
      </div>

      {/* New idea form */}
      <IdeaForm onCreated={refetch} />

      {/* Loading state */}
      {loading && !ideas && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-md animate-skeleton bg-gradient-to-r from-bg-surface via-bg-elevated to-bg-surface bg-[length:200%_100%]" />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-xs text-red px-3 py-2 bg-red-subtle rounded-md">
          Failed to load ideas: {error.message}
        </div>
      )}

      {/* Idea cards */}
      {sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map(idea => (
            <IdeaCard key={idea.id} idea={idea} onRefresh={refetch} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {ideas && ideas.length === 0 && (
        <div className="text-center py-12 text-text-tertiary text-sm">
          No ideas yet. Create one above to get started.
        </div>
      )}
    </div>
  )
}
