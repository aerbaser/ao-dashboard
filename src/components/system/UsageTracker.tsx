import { usePolling } from '../../hooks/usePolling'
import { getRateLimits } from '../../lib/api'
import type { RateLimitFallback, RateLimitProfile, RateLimitsApiResponse } from '../../lib/types'

function normalizeResponse(data: RateLimitsApiResponse | null): RateLimitFallback | {
  cached: true
  stale: false
  profiles: RateLimitProfile[]
} | null {
  if (!data) {
    return null
  }

  if (Array.isArray(data)) {
    return {
      cached: true,
      stale: false,
      profiles: data,
    }
  }

  return data
}

function percent(used: number, limit: number) {
  if (limit <= 0) {
    return 0
  }

  return Math.round((used / limit) * 100)
}

export default function UsageTracker() {
  const { data } = usePolling(getRateLimits, 10_000)
  const rateLimits = normalizeResponse(data)

  if (!rateLimits) {
    return (
      <section className="bg-bg-surface border border-border-subtle rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Gateway Rate Limits</h2>
        <p className="text-sm text-text-secondary">Loading gateway cache…</p>
      </section>
    )
  }

  if (!rateLimits.cached || rateLimits.profiles.length === 0) {
    return (
      <section className="bg-bg-surface border border-border-subtle rounded-xl p-4">
        <h2 className="text-sm font-semibold mb-2">Gateway Rate Limits</h2>
        <p className="text-sm text-text-secondary">
          Cache unavailable{rateLimits.stale ? ' or stale' : ''}. The dashboard is waiting for the
          gateway to write a fresh rate-limit snapshot.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-bg-surface border border-border-subtle rounded-xl p-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h2 className="text-sm font-semibold">Gateway Rate Limits</h2>
        <span className="text-xs text-text-secondary">
          {rateLimits.stale ? 'Stale cache' : 'Live cache'}
        </span>
      </div>

      <div className="space-y-3">
        {rateLimits.profiles.map((profile) => {
          const tokenPercent = percent(profile.tokens_used, profile.tokens_limit)
          const requestPercent = percent(profile.requests_used, profile.requests_limit)

          return (
            <article
              key={`${profile.profile}:${profile.model}`}
              className="bg-bg-elevated border border-border-subtle rounded-lg p-3"
            >
              <div className="flex items-center justify-between gap-4 mb-2">
                <div>
                  <h3 className="text-sm font-medium">{profile.profile}</h3>
                  <p className="text-xs text-text-secondary">{profile.model || 'Model unknown'}</p>
                </div>
                <span className="text-xs text-text-tertiary">{profile.reset_at || 'No reset time'}</span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                    <span>Tokens</span>
                    <span>{profile.tokens_used}/{profile.tokens_limit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-base overflow-hidden">
                    <div
                      className="h-full bg-status-healthy rounded-full"
                      style={{ width: `${Math.min(tokenPercent, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                    <span>Requests</span>
                    <span>{profile.requests_used}/{profile.requests_limit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg-base overflow-hidden">
                    <div
                      className="h-full bg-accent-amber rounded-full"
                      style={{ width: `${Math.min(requestPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
