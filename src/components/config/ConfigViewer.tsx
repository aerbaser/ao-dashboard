import { useState, useEffect, useMemo } from 'react'
import CopyButton from '../ui/CopyButton'

const SECTION_ORDER = ['agents', 'auth', 'memory', 'session', 'gateway', 'models', 'tools', 'hooks', 'channels', 'bindings', 'commands', 'skills', 'plugins', 'browser', 'meta', 'wizard']

function isRedacted(value: unknown): boolean {
  return value === '••••••••'
}

function ValueDisplay({ value }: { value: unknown }) {
  if (typeof value === 'boolean') {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono ${
        value ? 'bg-emerald-subtle text-emerald' : 'bg-red-subtle text-red'
      }`}>
        {value ? 'true' : 'false'}
      </span>
    )
  }
  if (typeof value === 'number') {
    return <span className="text-amber font-mono text-sm">{value}</span>
  }
  // Strings: emerald for short values, primary for long paths/URLs
  const str = String(value)
  const color = str.length > 80 ? 'text-text-primary' : 'text-emerald'
  return <span className={`${color} font-mono text-sm break-all`}>{str}</span>
}

function ConfigValue({ label, value, searchMatch }: { label: string; value: unknown; searchMatch?: boolean }) {
  if (value === null || value === undefined) return null

  if (isRedacted(value)) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 py-1 group">
        <span className="text-text-secondary text-sm sm:min-w-[180px] font-mono sm:shrink-0">{label}</span>
        <span className="text-text-tertiary text-sm font-mono flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 7H6V5a2 2 0 1 1 4 0v3z"/>
          </svg>
          ••••••••
        </span>
      </div>
    )
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return <ConfigSection label={label} data={value as Record<string, unknown>} nested />
  }

  if (Array.isArray(value)) {
    return (
      <div className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 py-1 group ${searchMatch ? 'bg-amber-subtle/30 -mx-2 px-2 rounded' : ''}`}>
        <span className="text-text-secondary text-sm sm:min-w-[180px] font-mono sm:shrink-0">{label}</span>
        <div className="flex flex-wrap gap-1 min-w-0 overflow-x-auto max-w-full">
          {value.map((item, i) => (
            <span key={i} className="bg-bg-surface text-text-secondary text-xs font-mono px-2 py-0.5 rounded border border-border-subtle break-all" style={{ borderRadius: '4px' }}>
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
            </span>
          ))}
        </div>
        <CopyButton text={JSON.stringify(value)} />
      </div>
    )
  }

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 py-1 group ${searchMatch ? 'bg-amber-subtle/30 -mx-2 px-2 rounded' : ''}`}>
      <span className="text-text-secondary text-sm sm:min-w-[180px] font-mono sm:shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0 overflow-hidden">
        <ValueDisplay value={value} />
        <CopyButton text={String(value)} />
      </div>
    </div>
  )
}

function ConfigSection({ label, data, nested, filter }: { label: string; data: Record<string, unknown>; nested?: boolean; filter?: string }) {
  const [collapsed, setCollapsed] = useState(nested ?? false)

  // If filter is active and this section has no matching keys/values, skip
  const entries = Object.entries(data)
  const hasMatch = !filter || entries.some(([k, v]) =>
    k.toLowerCase().includes(filter) ||
    String(v).toLowerCase().includes(filter) ||
    (typeof v === 'object' && JSON.stringify(v).toLowerCase().includes(filter))
  )

  if (filter && !hasMatch) return null

  return (
    <div className={nested ? 'ml-4 border-l border-border-subtle pl-3 my-1' : 'mb-4'}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 text-left w-full group"
      >
        <svg
          className={`w-3 h-3 text-text-tertiary transition-transform ${collapsed ? '' : 'rotate-90'}`}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M6 4l4 4-4 4z" />
        </svg>
        <span className={`font-semibold ${nested ? 'text-sm text-text-secondary' : 'text-md text-amber'}`}>
          {label}
        </span>
        <span className="text-xs text-text-tertiary font-mono">
          {entries.length} fields
        </span>
      </button>
      {!collapsed && (
        <div className={nested ? 'mt-1' : 'mt-2 ml-5'}>
          {entries.map(([k, v]) => {
            const matchesFilter = filter && (
              k.toLowerCase().includes(filter) ||
              String(v).toLowerCase().includes(filter)
            )
            return <ConfigValue key={k} label={k} value={v} searchMatch={!!matchesFilter} />
          })}
        </div>
      )}
    </div>
  )
}

export default function ConfigViewer() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/config/gateway')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setConfig(data)
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const filter = useMemo(() => search.trim().toLowerCase(), [search])

  if (loading) {
    return <div className="text-text-tertiary text-sm animate-pulse">Loading config...</div>
  }

  if (error) {
    return <div className="text-red text-sm">Error: {error}</div>
  }

  if (!config) return null

  const orderedKeys = SECTION_ORDER.filter(k => k in config)
  const extraKeys = Object.keys(config).filter(k => !SECTION_ORDER.includes(k))
  const allKeys = [...orderedKeys, ...extraKeys]

  return (
    <div className="max-w-4xl">
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <p className="text-text-tertiary text-xs font-mono">~/.openclaw/openclaw.json — read-only</p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter config…"
          className="ml-auto bg-bg-void border border-border-default text-text-primary text-xs font-mono px-3 py-1.5 rounded-sm w-48 focus:border-amber focus:outline-none"
        />
      </div>

      {allKeys.map(key => {
        const value = config[key]
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return <ConfigSection key={key} label={key} data={value as Record<string, unknown>} filter={filter || undefined} />
        }
        return <ConfigValue key={key} label={key} value={value} />
      })}
    </div>
  )
}
