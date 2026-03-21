import { useState, useEffect, useMemo } from 'react'
import { getDecisions, type Decision } from '../../lib/api'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'

type SortField = 'agent' | 'task_id' | 'gate_type' | 'result' | 'timestamp'
type SortDir = 'asc' | 'desc'

const resultBadge: Record<string, string> = {
  PASS: 'bg-accent-emerald-subtle text-accent-emerald',
  FAIL: 'bg-accent-red-subtle text-accent-red',
  DELEGATED: 'bg-accent-amber-subtle text-accent-amber',
}

export default function DecisionTrail() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterAgent, setFilterAgent] = useState('')
  const [filterTaskId, setFilterTaskId] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getDecisions()
      .then((data) => {
        if (!cancelled) {
          setDecisions(data)
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
    const set = new Set(decisions.map((d) => d.agent).filter(Boolean))
    return Array.from(set).sort()
  }, [decisions])

  const filtered = useMemo(() => {
    let result = decisions
    if (filterAgent) result = result.filter((d) => d.agent === filterAgent)
    if (filterTaskId) result = result.filter((d) => d.task_id?.includes(filterTaskId))
    if (filterDateFrom) {
      result = result.filter((d) => (d.timestamp || d.ts || '') >= filterDateFrom)
    }
    if (filterDateTo) {
      result = result.filter((d) => (d.timestamp || d.ts || '') <= filterDateTo + 'T23:59:59')
    }

    result = [...result].sort((a, b) => {
      const av = String((a as Record<string, unknown>)[sortField] ?? '')
      const bv = String((b as Record<string, unknown>)[sortField] ?? '')
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return result
  }, [decisions, filterAgent, filterTaskId, filterDateFrom, filterDateTo, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return ''
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  if (loading) {
    return (
      <div className="flex-1 p-3 space-y-2">
        <Skeleton lines={5} height="24px" className="w-full" />
      </div>
    )
  }
  if (error) {
    return <div className="flex items-center justify-center h-full text-accent-red text-sm">{error}</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-surface flex-wrap">
        <select
          value={filterAgent}
          onChange={(e) => setFilterAgent(e.target.value)}
          className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Task ID…"
          value={filterTaskId}
          onChange={(e) => setFilterTaskId(e.target.value)}
          className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm w-32"
        />
        <input
          type="date"
          value={filterDateFrom}
          onChange={(e) => setFilterDateFrom(e.target.value)}
          className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm"
        />
        <span className="text-text-tertiary text-xs">to</span>
        <input
          type="date"
          value={filterDateTo}
          onChange={(e) => setFilterDateTo(e.target.value)}
          className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm"
        />
        <span className="text-xs text-text-tertiary font-mono ml-auto">{filtered.length} rows</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs font-mono">
          <thead className="bg-bg-surface sticky top-0">
            <tr className="text-text-tertiary text-left">
              {(['agent', 'task_id', 'gate_type', 'result', 'timestamp'] as SortField[]).map((field) => (
                <th
                  key={field}
                  onClick={() => toggleSort(field)}
                  className="px-3 py-2 cursor-pointer hover:text-text-primary whitespace-nowrap"
                >
                  {field.replace('_', ' ').toUpperCase()}{sortIndicator(field)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex items-center justify-center py-8">
                    <EmptyState icon="◇" title="No decisions recorded" />
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((d, i) => (
                <tr key={i} className="border-b border-border-subtle hover:bg-bg-hover">
                  <td className="px-3 py-1.5">{d.agent || '—'}</td>
                  <td className="px-3 py-1.5 text-accent-blue">{d.task_id || '—'}</td>
                  <td className="px-3 py-1.5">{d.gate_type || '—'}</td>
                  <td className="px-3 py-1.5">
                    {d.result ? (
                      <span className={`px-1.5 py-0.5 rounded-sm ${resultBadge[d.result] || 'bg-bg-elevated text-text-secondary'}`}>
                        {d.result}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-text-tertiary">{d.timestamp || d.ts || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
