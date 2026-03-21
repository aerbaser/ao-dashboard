import { useEffect, useState } from 'react'

interface RateLimitProfile {
  profile: string
  tokens_used: number
  tokens_limit: number
  requests_used: number
  requests_limit: number
  reset_at: string
  model: string
}

interface RateLimitsResponse {
  cached: boolean
  stale: boolean
  profiles: RateLimitProfile[]
}

const POLL_INTERVAL = 10_000

export default function UsageTracker() {
  const [data, setData] = useState<RateLimitsResponse | null>(null)

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch('/api/rate-limits')
        if (res.ok && active) {
          setData(await res.json())
        }
      } catch {
        // Retry on next interval
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => { active = false; clearInterval(id) }
  }, [])

  if (!data) return <div>Loading usage data…</div>

  if (!data.cached || data.profiles.length === 0) {
    return (
      <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
        <p>Rate-limit cache: {data.cached ? 'available' : 'unavailable'}{data.stale ? ' (stale)' : ''}</p>
        <p>No profiles loaded.</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
      <h3>Rate Limits {data.stale && '(stale)'}</h3>
      {data.profiles.map(p => {
        const tokenPct = p.tokens_limit > 0
          ? Math.round((p.tokens_used / p.tokens_limit) * 100)
          : 0
        const reqPct = p.requests_limit > 0
          ? Math.round((p.requests_used / p.requests_limit) * 100)
          : 0
        return (
          <div key={p.profile} style={{ marginBottom: '0.5rem' }}>
            <strong>{p.profile}</strong> ({p.model})
            <div>Tokens: {p.tokens_used}/{p.tokens_limit} ({tokenPct}%)</div>
            <div>Requests: {p.requests_used}/{p.requests_limit} ({reqPct}%)</div>
            <div>Resets: {p.reset_at}</div>
          </div>
        )
      })}
    </div>
  )
}
