import { useState, useEffect, useMemo } from 'react'
import { getEvents, type Event } from '../../lib/api'

const eventIcons: Record<string, string> = {
  state_transition: '⟳',
  assignment: '→',
  escalation: '⚠',
  delegation: '↗',
  completion: '✓',
  failure: '✗',
  start: '▶',
  pause: '⏸',
  resume: '▶',
  created: '+',
}

function getEventIcon(type?: string): string {
  if (!type) return '•'
  return eventIcons[type] || '•'
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
    const set = new Set(events.map((e) => e.actor || e.agent).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [events])

  const eventTypes = useMemo(() => {
    const set = new Set(events.map((e) => e.type).filter(Boolean))
    return Array.from(set).sort() as string[]
  }, [events])

  const filtered = useMemo(() => {
    let result = events
    if (filterTaskId) result = result.filter((e) => e.task_id?.includes(filterTaskId))
    if (filterAgent) result = result.filter((e) => (e.actor || e.agent) === filterAgent)
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
              const actor = evt.actor || evt.agent
              const ts = evt.timestamp || evt.ts
              const dataSummary = evt.data
                ? Object.entries(evt.data)
                    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                    .join(', ')
                : null

              return (
                <div key={i} className="flex items-start gap-3 px-3 py-2 hover:bg-bg-hover">
                  {/* Icon */}
                  <span className="text-md mt-0.5 w-5 text-center shrink-0 text-text-tertiary">
                    {getEventIcon(evt.type)}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {evt.type && (
                        <span className="text-xs font-mono text-text-primary">{evt.type}</span>
                      )}
                      {actor && (
                        <span className="px-1.5 py-0.5 rounded-sm text-xs font-mono bg-accent-blue-subtle text-accent-blue">
                          {actor}
                        </span>
                      )}
                      {evt.task_id && (
                        <span className="px-1.5 py-0.5 rounded-sm text-xs font-mono bg-bg-elevated text-text-secondary">
                          {evt.task_id}
                        </span>
                      )}
                      {ts && (
                        <span className="text-xs font-mono text-text-tertiary ml-auto shrink-0">
                          {ts}
                        </span>
                      )}
                    </div>
                    {dataSummary && (
                      <p className="text-xs text-text-tertiary mt-0.5 truncate">{dataSummary}</p>
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
