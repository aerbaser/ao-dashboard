import { useState, useEffect } from 'react'
import { fetchPipelineItems } from '../lib/api'
import type { PipelineItem } from '../lib/api'
import { usePolling } from '../hooks/usePolling'

// ─── Freshness Indicator ──────────────────────────────────────────────────────

function Freshness({ ts }: { ts: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  const label = seconds < 5 ? 'just now' : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`
  return <span className="ml-3 text-[11px] font-mono text-text-disabled">Updated {label}</span>
}

// ─── Pipeline Card ────────────────────────────────────────────────────────────

function PipelineCard({ item }: { item: PipelineItem }) {
  const badgeColor = item.status === 'blocked' ? 'bg-red/20 text-red'
    : item.status === 'completed' ? 'bg-emerald/20 text-emerald'
    : 'bg-amber/20 text-amber'
  return (
    <div className="p-3 bg-bg-surface border border-border-subtle rounded-md">
      <div className="text-sm font-medium text-text-primary">{item.title}</div>
      {item.description && <div className="text-xs text-text-secondary mt-1">{item.description}</div>}
      <div className="flex items-center gap-2 mt-2">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${badgeColor}`}>{item.status}</span>
        {item.owner && <span className="text-[10px] text-text-tertiary font-mono">{item.owner}</span>}
        {item.source === 'task-store' && <span className="text-[10px] text-text-disabled">task-store</span>}
      </div>
    </div>
  )
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'blocked', label: '🔴 Blocked', filter: (i: PipelineItem) => i.section === 'blocked' || i.status === 'blocked' },
  { key: 'in_progress', label: '🟡 In Progress', filter: (i: PipelineItem) => i.section === 'in_progress' && i.status !== 'completed' },
  { key: 'open_questions', label: '❓ Open Questions', filter: (i: PipelineItem) => i.section === 'open_questions' },
  { key: 'done', label: '✅ Done', filter: (i: PipelineItem) => i.section === 'done' || i.status === 'completed' },
] as const

// ─── Pipeline Page ────────────────────────────────────────────────────────────

export default function Pipeline() {
  const { data: rawItems } = usePolling(fetchPipelineItems, 15000)
  const items: PipelineItem[] = rawItems ?? []
  const [hideEmpty, setHideEmpty] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())

  useEffect(() => {
    if (rawItems) setLastUpdated(Date.now())
  }, [rawItems])

  const visibleColumns = hideEmpty
    ? COLUMNS.filter(col => items.some(col.filter))
    : COLUMNS

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <h1 className="text-lg font-semibold text-text-primary">Pipeline</h1>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={hideEmpty}
              onChange={e => setHideEmpty(e.target.checked)}
              className="rounded"
            />
            Hide empty
          </label>
          <Freshness ts={lastUpdated} />
        </div>
      </div>
      {/* Columns */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-4 gap-4 h-full">
          {visibleColumns.map(col => {
            const colItems = items.filter(col.filter)
            return (
              <div key={col.key} className="flex flex-col gap-2">
                <div className="text-sm font-semibold text-text-secondary mb-2">
                  {col.label} <span className="text-text-disabled font-normal">({colItems.length})</span>
                </div>
                {colItems.map(item => (
                  <PipelineCard key={item.id} item={item} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
