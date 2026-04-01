import { useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../hooks/useToast'
import { fetchIdeas, submitApprovalDecision, createTask, approveIdea } from '../lib/api'
import type { Idea, ApprovalAction } from '../lib/types'
import ApprovalCard from '../components/approvals/ApprovalCard'
import EmptyState from '../components/ui/EmptyState'

export default function ApprovalsPage() {
  const { push } = useToast()

  const fetcher = useCallback(() => fetchIdeas('pending_approval'), [])
  const { data: ideas, loading, error, refetch } = usePolling(fetcher, 5000)

  const handleDecision = async (id: string, action: ApprovalAction, reason?: string) => {
    try {
      const result = await submitApprovalDecision(id, action, reason)

      if (action === 'yes') {
        // On approval, create task and wire it to the idea
        const idea = result.idea
        try {
          const { task_id } = await createTask({
            title: idea.title,
            route: 'artifact_route',
            outcome_type: 'strategy_doc',
          })
          await approveIdea(id, task_id)
          push({
            message: `Approved — task ${task_id} created`,
            variant: 'success',
            action: { label: 'Open Pipeline', fn: () => { window.location.href = `/pipeline?task=${task_id}` } },
          })
        } catch (routeErr) {
          push({
            message: `Approved but task routing failed: ${routeErr instanceof Error ? routeErr.message : 'unknown error'}`,
            variant: 'warning',
          })
        }
      } else if (action === 'later') {
        push({ message: 'Deferred — will revisit later', variant: 'warning' })
      } else if (action === 'no') {
        push({ message: 'Rejected and archived', variant: 'success' })
      } else if (action === 'rescope') {
        push({ message: 'Sent back to draft for rescoping', variant: 'success' })
      }

      await refetch()
    } catch (err: unknown) {
      const errObj = err as Record<string, string> | Error
      if ('error' in errObj && (errObj as Record<string, string>).error === 'STALE_STATE') {
        push({
          message: (errObj as Record<string, string>).message || 'Item already resolved elsewhere',
          variant: 'warning',
        })
        await refetch()
      } else {
        push({
          message: err instanceof Error ? err.message : 'Decision failed',
          variant: 'error',
        })
      }
    }
  }

  const queue: Idea[] = ideas ?? []

  return (
    <div className="min-h-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-text-primary">Approvals</h1>
        {queue.length > 0 && (
          <span className="text-[10px] font-bold bg-accent-purple text-text-inverse rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {queue.length}
          </span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-subtle border border-red rounded-md text-sm text-red">
          Failed to load approvals: {error.message}
          <button onClick={refetch} className="ml-2 underline">Retry</button>
        </div>
      )}

      {/* Loading state */}
      {loading && !ideas ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-bg-surface border border-border-subtle rounded-md animate-skeleton" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon="✓"
          title="No items pending approval"
          description="Ideas that need your decision will appear here"
        />
      ) : (
        <div className="space-y-3">
          {queue.map((idea) => (
            <ApprovalCard key={idea.id} idea={idea} onDecision={handleDecision} />
          ))}
        </div>
      )}
    </div>
  )
}
