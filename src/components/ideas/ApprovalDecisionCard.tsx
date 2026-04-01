import type { ApprovalDecision, ApprovalQueueItem, ApprovalState } from '../../lib/types'

interface ApprovalDecisionCardProps {
  item: ApprovalQueueItem
  submitting: boolean
  onDecision: (id: string, decision: ApprovalDecision) => void
}

const STATE_STYLES: Record<ApprovalState, string> = {
  pending: 'bg-amber-subtle text-amber',
  later: 'bg-blue-subtle text-blue',
  no: 'bg-red-subtle text-red',
  rescope: 'bg-accent-purple-subtle text-accent-purple',
  routing_failed: 'bg-red-subtle text-red',
  routed: 'bg-emerald-subtle text-emerald',
}

const STATE_LABELS: Record<ApprovalState, string> = {
  pending: 'Needs decision',
  later: 'Later',
  no: 'No',
  rescope: 'Rescope',
  routing_failed: 'Route failed',
  routed: 'Routed',
}

function prettyRoute(value?: string | null) {
  if (!value) return 'unknown'
  return value.replace(/_route$/, '').replace(/_/g, ' ')
}

function prettyOutcome(value?: string | null) {
  if (!value) return 'unknown'
  return value.replace(/_/g, ' ')
}

function relativeTime(iso: string | null) {
  if (!iso) return 'unknown'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ApprovalDecisionCard({
  item,
  submitting,
  onDecision,
}: ApprovalDecisionCardProps) {
  const actionable = item.approval_state !== 'routed'

  return (
    <article className="rounded-lg border border-border-subtle bg-bg-surface shadow-panel">
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-text-tertiary">
              Approval lane
            </p>
            <h3 className="mt-1 text-sm font-semibold text-text-primary">{item.title}</h3>
          </div>
          <span className={`shrink-0 rounded-sm px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${STATE_STYLES[item.approval_state]}`}>
            {STATE_LABELS[item.approval_state]}
          </span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Why</p>
            <p className="mt-1 text-sm text-text-secondary">{item.why || 'Approval context unavailable'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Next action</p>
            <p className="mt-1 text-sm text-text-secondary">{item.next_action || 'Await operator decision'}</p>
          </div>
        </div>

        <div className="grid gap-3 text-xs text-text-secondary md:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Route</p>
            <p className="mt-1 font-mono text-text-primary">{prettyRoute(item.route)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Outcome</p>
            <p className="mt-1 font-mono text-text-primary">{prettyOutcome(item.expected_outcome)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Owner</p>
            <p className="mt-1 font-mono text-text-primary">{item.owner || 'unknown'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-tertiary">Pending since</p>
            <p className="mt-1 font-mono text-text-primary">{relativeTime(item.pending_since)}</p>
          </div>
        </div>

        {(item.decision_note || item.error) && (
          <div className={`rounded-md border px-3 py-2 text-xs ${
            item.error
              ? 'border-red bg-red-subtle text-red'
              : 'border-border-default bg-bg-elevated text-text-secondary'
          }`}>
            {item.error || item.decision_note}
          </div>
        )}

        {item.task_id && (
          <a
            href={`/pipeline?task=${item.task_id}`}
            className="inline-flex items-center rounded-sm bg-emerald-subtle px-2 py-1 text-xs font-mono text-emerald hover:brightness-110"
          >
            {item.task_id}
          </a>
        )}

        <div className="flex flex-wrap gap-2">
          {actionable ? (
            <>
              <button
                onClick={() => onDecision(item.id, 'yes')}
                disabled={submitting}
                className="rounded-sm bg-emerald px-3 py-1.5 text-xs font-semibold text-text-inverse hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : 'Yes'}
              </button>
              <button
                onClick={() => onDecision(item.id, 'later')}
                disabled={submitting}
                className="rounded-sm border border-blue bg-blue-subtle px-3 py-1.5 text-xs font-semibold text-blue hover:brightness-110 disabled:opacity-50"
              >
                Later
              </button>
              <button
                onClick={() => onDecision(item.id, 'no')}
                disabled={submitting}
                className="rounded-sm border border-red bg-red-subtle px-3 py-1.5 text-xs font-semibold text-red hover:brightness-110 disabled:opacity-50"
              >
                No
              </button>
              <button
                onClick={() => onDecision(item.id, 'rescope')}
                disabled={submitting}
                className="rounded-sm border border-accent-amber bg-accent-purple-subtle px-3 py-1.5 text-xs font-semibold text-accent-purple hover:brightness-110 disabled:opacity-50"
              >
                Rescope
              </button>
            </>
          ) : (
            <span className="text-xs text-text-tertiary">
              Decision already routed into the task lane.
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
