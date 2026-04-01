import { useState, useCallback } from 'react'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../hooks/useToast'
import {
  fetchIdeas,
  createIdea,
  updateIdea,
  deleteIdea,
  createTask,
  approveIdea,
  fetchApprovalQueue,
  submitIdeaApprovalDecision,
} from '../lib/api'
import type { ApprovalDecision, IdeaStatus } from '../lib/types'
import IdeaCard from '../components/ideas/IdeaCard'
import IdeaForm from '../components/ideas/IdeaForm'
import ApprovalQueue from '../components/ideas/ApprovalQueue'
import EmptyState from '../components/ui/EmptyState'

const FILTER_TABS: { label: string; value: IdeaStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Brainstorming', value: 'brainstorming' },
  { label: 'Ready', value: 'artifact_ready' },
  { label: 'In Work', value: 'in_work' },
  { label: 'Archived', value: 'archived' },
]

export default function IdeasPage() {
  const [activeTab, setActiveTab] = useState<IdeaStatus | 'all'>('all')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submittingApprovalId, setSubmittingApprovalId] = useState<string | null>(null)
  const { push } = useToast()

  const ideasFetcher = useCallback(() => fetchIdeas(), [])
  const approvalFetcher = useCallback(() => fetchApprovalQueue(), [])
  const { data: ideas, loading, refetch } = usePolling(ideasFetcher, 5000)
  const {
    data: approvalQueue,
    loading: approvalLoading,
    error: approvalError,
    refetch: refetchApprovalQueue,
  } = usePolling(approvalFetcher, 5000)

  const approvalIds = new Set((approvalQueue || []).map((item) => item.id))

  const filtered = ideas
    ? activeTab === 'all'
      ? ideas.filter((i) => !approvalIds.has(i.id))
      : ideas.filter((i) => i.status === activeTab && !approvalIds.has(i.id))
    : []

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message
    if (err && typeof err === 'object') {
      const message = 'message' in err && typeof err.message === 'string' ? err.message : null
      const error = 'error' in err && typeof err.error === 'string' ? err.error : null
      const detail = 'detail' in err && typeof err.detail === 'string' ? err.detail : null
      return [error, message, detail].filter(Boolean).join(': ') || 'Request failed'
    }
    return 'Request failed'
  }

  const handleCreate = async (data: { title: string; body: string; tags: string[]; target_agent: string }) => {
    setSubmitting(true)
    try {
      await createIdea(data)
      setShowForm(false)
      push({ message: 'Idea created', variant: 'success' })
      await refetch()
    } catch (err) {
      push({ message: err instanceof Error ? err.message : 'Failed to create idea', variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (id: string, status: IdeaStatus) => {
    try {
      await updateIdea(id, { status })
      await refetch()
    } catch (err) {
      push({ message: err instanceof Error ? err.message : 'Failed to update', variant: 'error' })
    }
  }

  const handleApprove = async (id: string) => {
    const idea = ideas?.find((i) => i.id === id)
    if (!idea) return

    try {
      const { task_id } = await createTask({
        title: idea.title,
        route: 'artifact_route',
        outcome_type: 'strategy_doc',
      })
      await approveIdea(id, task_id)
      push({
        message: `Task created: ${task_id}`,
        variant: 'success',
        action: { label: 'Open Pipeline', fn: () => { window.location.href = `/pipeline?task=${task_id}` } },
      })
      await refetch()
    } catch (err) {
      push({ message: err instanceof Error ? err.message : 'Failed to approve idea', variant: 'error' })
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await deleteIdea(id)
      await refetch()
    } catch (err) {
      push({ message: err instanceof Error ? err.message : 'Failed to archive', variant: 'error' })
    }
  }

  const handleApprovalDecision = async (id: string, decision: ApprovalDecision) => {
    setSubmittingApprovalId(id)
    try {
      const result = await submitIdeaApprovalDecision(id, decision)
      const label = decision === 'yes' ? 'Yes' : decision[0].toUpperCase() + decision.slice(1)
      push({
        message: result.task_id
          ? `Routed to task ${result.task_id}`
          : `Decision saved: ${label}`,
        variant: 'success',
        action: result.task_id
          ? { label: 'Open Pipeline', fn: () => { window.location.href = `/pipeline?task=${result.task_id}` } }
          : undefined,
      })
      await Promise.all([refetchApprovalQueue(), refetch()])
    } catch (err) {
      const message = getErrorMessage(err)
      await Promise.all([refetchApprovalQueue(), refetch()])
      push({ message, variant: 'error' })
    } finally {
      setSubmittingApprovalId(null)
    }
  }

  // Badge count: draft + artifact_ready
  const badgeCount = ideas
    ? ideas.filter((i) => i.status === 'draft' || i.status === 'artifact_ready').length
    : 0

  return (
    <div className="min-h-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-text-primary">Ideas</h1>
          {badgeCount > 0 && (
            <span className="text-[10px] font-bold bg-accent-amber text-text-inverse rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {badgeCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="px-3 py-1.5 text-sm font-medium rounded-sm bg-amber text-text-inverse hover:brightness-110 transition-all"
        >
          + New Idea
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <IdeaForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          submitting={submitting}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTER_TABS.map((tab) => {
          const count = ideas
            ? tab.value === 'all'
              ? ideas.length
              : ideas.filter((i) => i.status === tab.value).length
            : 0
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 px-3 py-1.5 text-xs rounded-sm transition-colors ${
                activeTab === tab.value
                  ? 'bg-amber text-text-inverse'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      <ApprovalQueue
        items={approvalQueue || []}
        loading={approvalLoading}
        error={approvalError}
        submittingId={submittingApprovalId}
        onDecision={handleApprovalDecision}
      />

      {/* Ideas grid */}
      {loading && !ideas ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-bg-surface border border-border-subtle rounded-md animate-skeleton" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="💡"
          title={activeTab === 'all' ? 'No ideas yet' : `No ${activeTab.replace('_', ' ')} ideas`}
          description="Create your first idea to get started"
          action={!showForm ? { label: '+ New Idea', onClick: () => setShowForm(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onStatusChange={handleStatusChange}
              onApprove={handleApprove}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}
    </div>
  )
}
