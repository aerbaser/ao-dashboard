import EmptyState from '../ui/EmptyState'
import Skeleton from '../ui/Skeleton'
import type { ApprovalDecision, ApprovalQueueItem } from '../../lib/types'
import ApprovalDecisionCard from './ApprovalDecisionCard'

interface ApprovalQueueProps {
  items: ApprovalQueueItem[]
  loading: boolean
  error: Error | null
  submittingId: string | null
  onDecision: (id: string, decision: ApprovalDecision) => void
}

export default function ApprovalQueue({
  items,
  loading,
  error,
  submittingId,
  onDecision,
}: ApprovalQueueProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-text-tertiary">
            Operator flow
          </p>
          <h2 className="mt-1 text-lg font-semibold text-text-primary">Approval Queue</h2>
        </div>
        <span className="rounded-full bg-amber-subtle px-2.5 py-1 text-[11px] font-semibold text-amber">
          {items.length}
        </span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">Loading approval queue…</p>
          <div className="grid gap-3">
            {[1, 2].map((index) => (
              <div key={index} className="rounded-lg border border-border-subtle bg-bg-surface px-4 py-4">
                <Skeleton height="16px" width="40%" />
                <div className="mt-3">
                  <Skeleton height="14px" lines={3} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red bg-red-subtle px-4 py-4">
          <p className="text-sm font-semibold text-red">Approval queue unavailable</p>
          <p className="mt-1 text-xs text-red">{error.message}</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="[]"
          title="No approvals waiting"
          description="Approval-needed ideas will appear here as durable decision cards."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ApprovalDecisionCard
              key={item.id}
              item={item}
              submitting={submittingId === item.id}
              onDecision={onDecision}
            />
          ))}
        </div>
      )}
    </section>
  )
}
