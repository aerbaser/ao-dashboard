import { useState } from 'react'
import type { Idea, IdeaStatus } from '../../lib/types'
import { brainstormIdea } from '../../lib/api'
import ArtifactPanel from './ArtifactPanel'

interface IdeaCardProps {
  idea: Idea
  onRefresh: () => void
}

const STATUS_CONFIG: Record<IdeaStatus, {
  label: string
  badgeClass: string
  borderClass: string
}> = {
  draft: {
    label: 'DRAFT',
    badgeClass: 'bg-bg-elevated text-text-secondary',
    borderClass: 'border-l-text-tertiary',
  },
  brainstorming: {
    label: 'THINKING...',
    badgeClass: 'bg-blue-subtle text-blue animate-pulse',
    borderClass: 'border-l-blue',
  },
  artifact_ready: {
    label: 'ARTIFACT READY',
    badgeClass: 'bg-emerald-subtle text-emerald',
    borderClass: 'border-l-emerald',
  },
  approved: {
    label: 'APPROVED',
    badgeClass: 'bg-emerald-subtle text-emerald',
    borderClass: 'border-l-emerald',
  },
  in_work: {
    label: 'IN WORK',
    badgeClass: 'bg-amber-subtle text-amber',
    borderClass: 'border-l-amber',
  },
  archived: {
    label: 'ARCHIVED',
    badgeClass: 'bg-bg-elevated text-text-tertiary',
    borderClass: 'border-l-text-disabled',
  },
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function IdeaCard({ idea, onRefresh }: IdeaCardProps) {
  const [loading, setLoading] = useState(false)
  const config = STATUS_CONFIG[idea.status] || STATUS_CONFIG.draft
  const isBrainstorming = idea.status === 'brainstorming'

  async function handleBrainstorm() {
    setLoading(true)
    try {
      await brainstormIdea(idea.id)
      onRefresh()
    } catch (err) {
      console.error('Brainstorm failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`
        relative overflow-hidden rounded-md border-l-[3px] bg-bg-surface
        ${config.borderClass}
        ${isBrainstorming ? 'animate-pulse-blue' : ''}
      `}
    >
      {/* Shimmer overlay for brainstorming state */}
      {isBrainstorming && (
        <div
          className="absolute inset-0 pointer-events-none animate-skeleton bg-gradient-to-r from-transparent via-blue-subtle to-transparent bg-[length:200%_100%]"
          aria-hidden
        />
      )}

      <div className="relative p-3 space-y-2">
        {/* Header: title + badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-text-primary truncate flex-1">
            {idea.title}
          </h3>
          <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide ${config.badgeClass}`}>
            {config.label}
          </span>
        </div>

        {/* Body */}
        {isBrainstorming ? (
          <p className="text-xs text-blue opacity-80">
            Brainstorming...
          </p>
        ) : idea.body ? (
          <p className="text-xs text-text-secondary line-clamp-2">
            {idea.body}
          </p>
        ) : null}

        {/* Artifact panel for artifact_ready */}
        {idea.status === 'artifact_ready' && idea.artifact_md && (
          <ArtifactPanel artifact={idea.artifact_md!} ideaId={idea.id} onApprove={() => onRefresh?.()} />
        )}

        {/* Footer: meta + actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
            <span>{timeAgo(idea.created_at)}</span>
            {idea.target_agent && (
              <span className="px-1 py-0.5 rounded-sm bg-bg-elevated">
                {idea.target_agent}
              </span>
            )}
            {idea.tags.map(tag => (
              <span key={tag} className="px-1 py-0.5 rounded-sm bg-bg-elevated">
                {tag}
              </span>
            ))}
          </div>

          {/* Brainstorm button — only on draft cards */}
          {idea.status === 'draft' && (
            <button
              onClick={handleBrainstorm}
              disabled={loading}
              className="text-[11px] font-medium px-2 py-1 rounded-sm bg-blue-subtle text-blue hover:bg-blue/20 transition-colors disabled:opacity-50"
            >
              {loading ? 'Sending...' : '⚡ Brainstorm'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
