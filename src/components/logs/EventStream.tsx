import { useState, useEffect, useMemo } from 'react'
import { getEvents, type Event } from '../../lib/api'

const eventIcons: Record<string, string> = {
  STATE_CHANGED: '↺',
  ASSIGNMENT: '→',
  ASSIGNED: '→',
  ESCALATED: '↑',
  DELEGATED: '↗',
  ISSUE_CREATED: '#',
  STUCK_DETECTED: '!',
  COMPLETED: '✓',
  FAILED: '✕',
}

const eventMetaKeys = new Set([
  'event_id',
  'event_type',
  'type',
  'task_id',
  'actor',
  'agent',
  'timestamp',
  'ts',
  '_task_dir',
  'data',
])

function getEventIcon(type: string): string {
  return eventIcons[type] || '•'
}

function formatTypeLabel(type: string): string {
  return type.replace(/_/g, ' ')
}

function summarizeEvent(event: Event): string {
  if (event.type === 'STATE_CHANGED') {
    return `${String(event.from_state ?? 'unknown')} → ${String(event.to_state ?? 'unknown')}`
  }

  if (event.type === 'ISSUE_CREATED') {
    return event.issue_title ? `Created issue: ${String(event.issue_title)}` : 'Created issue'
  }

  if (event.type === 'ASSIGNMENT' || event.type === 'ASSIGNED') {
    const assignee = event.assignee || event.assigned_to || event.to_agent
    return assignee ? `Assigned to ${String(assignee)}` : 'Assignment updated'
  }

  if (event.type === 'ESCALATED') {
    return event.reason ? String(event.reason) : 'Escalated'
  }

  if (event.type === 'STUCK_DETECTED') {
    return `Stale for ${String(event.stale_minutes ?? 'unknown')} minutes`
  }

  const dataSummary = event.data
    ? Object.entries(event.data)
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
        .join(', ')
    : ''

  if (dataSummary) return dataSummary

  const summaryEntries = Object.entries(event)
    .filter(([key, value]) => !eventMetaKeys.has(key) && value != null)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)

  return summaryEntries.join(', ')
}

export default function EventStream() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterTaskId, setFilterTaskId] = useState('')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterType, setFilterType] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getEvents()
      .then((data) => {
        if (!cancelled) {
          setEvents(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const agents = useMemo(() => {
    const set = new Set(events.map((e) => e.actor))
    return Array.from(set).sort() as string[]
  }, [events])

  const eventTypes = useMemo(() => {
    const set = new Set(events.map((e) => e.type))
    return Array.from(set).sort() as string[]
  }, [events])

  const filtered = useMemo(() => {
    let result = events
    if (filterTaskId) result = result.filter((e) => e.task_id.includes(filterTaskId))
    if (filterAgent) result = result.filter((e) => e.actor === filterAgent)
    if (filterType) result = result.filter((e) => e.type === filterType)
    return result
  }, [events, filterTaskId, filterAgent, filterType])

  if (loading) {
    return <div className="flex items-center justify-center h-full text-text-tertiary text-sm">Loading events…</div>
  }
  if (error) {
    return <div className="flex items-center justify-center h-full text-accent-red text-sm">{error}</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-surface flex-wrap">
        <input
          type="text"
          placeholder="Task ID…"
          value={filterTaskId}
          onChange={(e) => setFilterTaskId(e.target.value)}
          className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm w-32"
        />
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm"
        >
          <option value="">All Actors</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm"
        >
          <option value="">All Types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-xs text-text-tertiary font-mono ml-auto">{filtered.length} events</span>
      </div>

      {/* Event feed */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
            No events found
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {filtered.map((evt, i) => {
              const dataSummary = summarizeEvent(evt)

              return (
                <div key={i} className="flex items-start gap-3 px-3 py-2 hover:bg-bg-hover">
                  {/* Icon */}
                  <span className="text-md mt-0.5 w-5 text-center shrink-0 text-text-tertiary">
                    {getEventIcon(evt.type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-text-primary">{formatTypeLabel(evt.type)}</span>
                      <span className="px-1.5 py-0.5 rounded-sm text-xs font-mono bg-accent-blue-subtle text-accent-blue">
                        {evt.actor}
                      </span>
                      <span className="px-1.5 py-0.5 rounded-sm text-xs font-mono bg-bg-elevated text-text-secondary">
                        {evt.task_id}
                      </span>
                      {evt.timestamp && (
                        <span className="text-xs font-mono text-text-tertiary ml-auto shrink-0">
                          {evt.timestamp}
                        </span>
                      )}
                    </div>
                    {dataSummary && (
                      <p className="text-xs text-text-tertiary mt-0.5 break-words">{dataSummary}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
