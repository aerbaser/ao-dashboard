import { useState } from 'react'
import type { Idea, IdeaStatus } from '../../lib/types'

interface IdeaCardProps {
  idea: Idea
  onStatusChange: (id: string, status: IdeaStatus) => void
  onApprove: (id: string) => Promise<void>
  onArchive: (id: string) => void
}

const STATUS_LABELS: Record<IdeaStatus, string> = {
  draft: 'Draft',
  brainstorming: 'Brainstorming',
  artifact_ready: 'Ready',
  approved: 'Approved',
  in_work: 'In Work',
  archived: 'Archived',
}

const STATUS_BADGE_CLASSES: Record<IdeaStatus, string> = {
  draft: 'bg-idea-draft text-text-secondary',
  brainstorming: 'bg-blue-subtle text-blue',
  artifact_ready: 'bg-emerald-subtle text-emerald',
  approved: 'bg-accent-purple-subtle text-accent-purple',
  in_work: 'bg-amber-subtle text-amber',
  archived: 'bg-bg-overlay text-text-tertiary',
}

const BORDER_CLASSES: Record<IdeaStatus, string> = {
  draft: 'border-l-idea-draft',
  brainstorming: 'border-l-idea-brainstorming',
  artifact_ready: 'border-l-idea-artifact-ready',
  approved: 'border-l-idea-approved',
  in_work: 'border-l-idea-in-work',
  archived: 'border-l-idea-archived',
}

function getNextActions(status: IdeaStatus): { label: string; next: IdeaStatus }[] {
  switch (status) {
    case 'draft':
      return [{ label: 'Start Brainstorm', next: 'brainstorming' }]
    case 'brainstorming':
      return [{ label: 'Mark Ready', next: 'artifact_ready' }]
    case 'artifact_ready':
      return []  // Approve handled separately via onApprove
    case 'approved':
      return []  // No manual "Start Work" — task creation handles this
    case 'in_work':
      return []
    case 'archived':
      return [{ label: 'Restore', next: 'draft' }]
  }
}

export default function IdeaCard({ idea, onStatusChange, onApprove, onArchive }: IdeaCardProps) {
  const actions = getNextActions(idea.status)
  const [approving, setApproving] = useState(false)

  const handleApprove = async () => {
    setApproving(true)
    try {
      await onApprove(idea.id)
    } finally {
      setApproving(false)
    }
  }

  return (
    <div
      className={`bg-bg-surface border border-border-subtle rounded-md border-l-[3px] ${BORDER_CLASSES[idea.status]} ${
        idea.status === 'brainstorming' ? 'animate-pulse-active' : ''
      } ${idea.status === 'archived' ? 'opacity-60' : ''}`}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-medium text-text-primary truncate flex-1">
            {idea.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {idea.task_id && (
              <a
                href={`/pipeline?task=${idea.task_id}`}
                className="text-[10px] px-1.5 py-0.5 rounded-sm bg-amber-subtle text-amber font-mono hover:brightness-110 transition-colors"
              >
                {idea.task_id}
              </a>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-sm ${STATUS_BADGE_CLASSES[idea.status]}`}>
              {STATUS_LABELS[idea.status]}
            </span>
          </div>
        </div>

        {/* ID */}
        <p className="text-[10px] text-text-tertiary font-mono mb-1.5">{idea.id}</p>

        {/* Body preview */}
        {idea.body && (
          <p className="text-xs text-text-secondary line-clamp-2 mb-2">
            {idea.body}
          </p>
        )}

        {/* Tags */}
        {idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {idea.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-sm bg-bg-overlay text-text-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-1">
          {actions.map((action) => (
            <button
              key={action.next}
              onClick={() => onStatusChange(idea.id, action.next)}
              className="text-[11px] px-2 py-1 rounded-sm bg-bg-hover text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-colors"
            >
              {action.label}
            </button>
          ))}
          {idea.status === 'artifact_ready' && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="text-[11px] px-2 py-1 rounded-sm bg-accent-purple-subtle text-accent-purple hover:brightness-110 transition-colors disabled:opacity-50"
            >
              {approving ? 'Creating Task…' : 'Approve & Create Task'}
            </button>
          )}
          {idea.status !== 'archived' && (
            <button
              onClick={() => onArchive(idea.id)}
              className="text-[11px] px-2 py-1 rounded-sm text-text-tertiary hover:text-red hover:bg-red-subtle transition-colors ml-auto"
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
