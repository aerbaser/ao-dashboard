import { useEffect, useState } from 'react'
import type { RateLimitsResponse } from '../../lib/types'
import { getUsageTone } from './usageTone'

interface UsageTrackerProps {
  data: RateLimitsResponse | null
  loading: boolean
  onSwitchProfile: (profile: string) => void | Promise<void>
}

function getProgress(used: number, limit: number) {
  if (limit <= 0) return 0
  return Math.min(1, used / limit)
}

function toneClasses(progress: number) {
  const tone = getUsageTone(progress)
  if (tone === 'red') return 'bg-red'
  if (tone === 'amber') return 'bg-amber'
  return 'bg-emerald'
}

function formatCountdown(resetAt: string | null, now: number) {
  if (!resetAt) return 'Unknown'
  const diff = Math.max(0, new Date(resetAt).getTime() - now)
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}

export default function UsageTracker({ data, loading, onSwitchProfile }: UsageTrackerProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !data) {
    return <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-sm text-text-tertiary">Loading usage data…</div>
  }

  if (!data || data.profiles.length === 0) {
    // Suppress raw error — show graceful empty state
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-text-disabled shrink-0" />
        <span className="text-xs text-text-tertiary">Usage data not yet available</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface shadow-panel">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Usage Tracker</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Live token and request budgets{data.stale ? ' (stale cache)' : ''}.
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {data.profiles.map((profile) => {
          const tokenProgress = getProgress(profile.tokens_used, profile.tokens_limit)
          const requestProgress = getProgress(profile.requests_used, profile.requests_limit)
          return (
            <div key={profile.id} className="rounded-md border border-border-default bg-bg-elevated p-3">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">{profile.label}</h3>
                    {profile.active && (
                      <span className="rounded-full border border-emerald/30 bg-emerald-subtle px-2 py-0.5 font-mono text-[11px] text-emerald">
                        active
                      </span>
                    )}
                  </div>
                  <p className="mt-1 font-mono text-xs text-text-tertiary">{profile.model}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onSwitchProfile(profile.profile)}
                  className="rounded-sm border border-border-subtle px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                >
                  Switch profile
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_132px] lg:items-center">
                <div>
                  <div className="mb-1 flex justify-between font-mono text-xs text-text-secondary">
                    <span>Tokens</span>
                    <span>{profile.tokens_used}/{profile.tokens_limit}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-overlay">
                    <div className={`h-full ${toneClasses(tokenProgress)}`} style={{ width: `${tokenProgress * 100}%` }} />
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between font-mono text-xs text-text-secondary">
                    <span>Requests</span>
                    <span>{profile.requests_used}/{profile.requests_limit}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-overlay">
                    <div className={`h-full ${toneClasses(requestProgress)}`} style={{ width: `${requestProgress * 100}%` }} />
                  </div>
                </div>

                <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2 font-mono text-xs text-text-secondary">
                  Reset in {formatCountdown(profile.reset_at, now)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
