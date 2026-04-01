import { useState } from 'react'
import type { Idea, ApprovalAction } from '../../lib/types'

interface ApprovalCardProps {
  idea: Idea
  onDecision: (id: string, action: ApprovalAction, reason?: string) => Promise<void>
}

function freshnessLabel(pendingSince: string | null | undefined): string {
  if (!pendingSince) return 'unknown'
  const mins = Math.floor((Date.now() - new Date(pendingSince).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function freshnessColor(pendingSince: string | null | undefined): string {
  if (!pendingSince) return 'text-text-tertiary'
  const hours = (Date.now() - new Date(pendingSince).getTime()) / 3600000
  if (hours < 1) return 'text-emerald'
  if (hours < 24) return 'text-amber'
  return 'text-red'
}

const ACTION_STYLES: Record<ApprovalAction, { label: string; classes: string; confirmLabel?: string }> = {
  yes: {
    label: 'Yes',
    classes: 'bg-emerald-subtle text-emerald hover:brightness-110',
  },
  later: {
    label: 'Later',
    classes: 'bg-amber-subtle text-amber hover:brightness-110',
  },
  no: {
    label: 'No',
    classes: 'bg-red-subtle text-red hover:brightness-110',
    confirmLabel: 'Archive this idea?',
  },
  rescope: {
    label: 'Rescope',
    classes: 'bg-blue-subtle text-blue hover:brightness-110',
  },
}

export default function ApprovalCard({ idea, onDecision }: ApprovalCardProps) {
  const [acting, setActing] = useState<ApprovalAction | null>(null)
  const [confirming, setConfirming] = useState<ApprovalAction | null>(null)
  const [reason, setReason] = useState('')

  const handleAction = async (action: ApprovalAction) => {
    // No/Rescope require confirmation
    if ((action === 'no' || action === 'rescope') && confirming !== action) {
      setConfirming(action)
      return
    }

    setActing(action)
    try {
      await onDecision(idea.id, action, reason || undefined)
    } finally {
      setActing(null)
      setConfirming(null)
      setReason('')
    }
  }

  const lastDecision = idea.approval_decisions?.length
    ? idea.approval_decisions[idea.approval_decisions.length - 1]
    : null

  return (
    <div className="bg-bg-surface border border-border-subtle rounded-md border-l-[3px] border-l-accent-purple">
      <div className="p-3 space-y-2">
        {/* Header: title + freshness */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-text-primary truncate flex-1">
            {idea.title}
          </h3>
          <span className={`text-[10px] shrink-0 ${freshnessColor(idea.pending_since)}`}>
            {freshnessLabel(idea.pending_since)}
          </span>
        </div>

        {/* Meta row: owner, route/outcome, id */}
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="px-1.5 py-0.5 rounded-sm bg-accent-purple-subtle text-accent-purple">
            owner: platon
          </span>
          {idea.target_agent && (
            <span className="px-1.5 py-0.5 rounded-sm bg-bg-overlay text-text-secondary">
              agent: {idea.target_agent}
            </span>
          )}
          <span className="text-text-tertiary font-mono">{idea.id}</span>
        </div>

        {/* Body / why approval is needed */}
        {idea.body && (
          <p className="text-xs text-text-secondary line-clamp-2">
            {idea.body}
          </p>
        )}

        {/* Artifact preview indicator */}
        {idea.artifact_md && (
          <p className="text-[10px] text-emerald">
            Artifact ready ({Math.round(idea.artifact_md.length / 1024)}kb)
          </p>
        )}

        {/* Previous decision note */}
        {lastDecision && lastDecision.action === 'later' && (
          <p className="text-[10px] text-amber bg-amber-subtle px-2 py-1 rounded-sm">
            Deferred {freshnessLabel(lastDecision.timestamp)}
            {lastDecision.reason && ` — ${lastDecision.reason}`}
          </p>
        )}

        {/* Tags */}
        {idea.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
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

        {/* Confirmation row */}
        {confirming && (
          <div className="flex items-center gap-2 bg-bg-overlay rounded-sm p-2">
            <input
              type="text"
              placeholder={confirming === 'rescope' ? 'Rescope reason…' : 'Reason (optional)…'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex-1 text-xs bg-transparent border-b border-border-subtle text-text-primary placeholder:text-text-tertiary outline-none py-0.5"
            />
            <button
              onClick={() => handleAction(confirming)}
              disabled={acting !== null}
              className="text-[11px] px-2 py-1 rounded-sm bg-red-subtle text-red hover:brightness-110 disabled:opacity-50"
            >
              {acting === confirming ? 'Saving…' : 'Confirm'}
            </button>
            <button
              onClick={() => { setConfirming(null); setReason('') }}
              className="text-[11px] px-2 py-1 rounded-sm text-text-tertiary hover:text-text-primary"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {(Object.entries(ACTION_STYLES) as [ApprovalAction, typeof ACTION_STYLES[ApprovalAction]][]).map(
            ([action, style]) => (
              <button
                key={action}
                onClick={() => handleAction(action)}
                disabled={acting !== null}
                className={`text-[11px] px-3 py-1 rounded-sm transition-colors disabled:opacity-50 ${style.classes}`}
              >
                {acting === action ? 'Saving…' : style.label}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
