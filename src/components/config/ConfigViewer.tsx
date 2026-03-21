import { useState, useEffect } from 'react'

const SECTION_ORDER = ['agents', 'auth', 'memory', 'session', 'gateway', 'models', 'tools', 'hooks', 'channels', 'bindings', 'commands', 'skills', 'plugins', 'browser', 'meta', 'wizard']

function isRedacted(value: unknown): boolean {
  return value === '••••••••'
}

function ConfigValue({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null

  if (isRedacted(value)) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-text-secondary text-sm min-w-[180px] font-mono">{label}</span>
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
    return (
      <ConfigSection label={label} data={value as Record<string, unknown>} nested />
    )
  }

  if (Array.isArray(value)) {
    return (
      <div className="flex items-start gap-2 py-1">
        <span className="text-text-secondary text-sm min-w-[180px] font-mono">{label}</span>
        <div className="flex flex-wrap gap-1">
          {value.map((item, i) => (
            <span key={i} className="bg-bg-surface text-text-secondary text-xs font-mono px-2 py-0.5 rounded-sm border border-border-subtle">
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
            </span>
          ))}
        </div>
      </div>
    )
  }

  const display = typeof value === 'boolean'
    ? (value ? 'true' : 'false')
    : String(value)

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-text-secondary text-sm min-w-[180px] font-mono">{label}</span>
      <span className={`text-sm font-mono ${typeof value === 'boolean' ? (value ? 'text-emerald' : 'text-text-tertiary') : 'text-text-primary'}`}>
        {display}
      </span>
    </div>
  )
}

function ConfigSection({ label, data, nested }: { label: string; data: Record<string, unknown>; nested?: boolean }) {
  const [collapsed, setCollapsed] = useState(nested ?? false)

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
        {collapsed && (
          <span className="text-xs text-text-tertiary">
            {Object.keys(data).length} fields
          </span>
        )}
      </button>
      {!collapsed && (
        <div className={nested ? 'mt-1' : 'mt-2 ml-5'}>
          {Object.entries(data).map(([k, v]) => (
            <ConfigValue key={k} label={k} value={v} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ConfigViewer() {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="text-text-tertiary text-sm animate-pulse">Loading config...</div>
    )
  }

  if (error) {
    return (
      <div className="text-ao-red text-sm">Error: {error}</div>
    )
  }

  if (!config) return null

  // Order sections predictably
  const orderedKeys = SECTION_ORDER.filter(k => k in config)
  const extraKeys = Object.keys(config).filter(k => !SECTION_ORDER.includes(k))
  const allKeys = [...orderedKeys, ...extraKeys]

  return (
    <div className="max-w-4xl">
      <p className="text-text-tertiary text-xs mb-4 font-mono">
        ~/.openclaw/openclaw.json — read-only
      </p>
      {allKeys.map(key => {
        const value = config[key]
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return <ConfigSection key={key} label={key} data={value as Record<string, unknown>} />
        }
        return <ConfigValue key={key} label={key} value={value} />
      })}
    </div>
  )
}
