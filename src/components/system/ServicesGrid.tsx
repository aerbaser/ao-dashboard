import type { ServiceInfo } from '../../lib/types'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'

const GROUPS = ['Core', 'Agents', 'Integrations'] as const
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-subtle text-emerald border-emerald/30',
  failed: 'bg-red-subtle text-red border-red/30',
  inactive: 'bg-bg-overlay text-text-secondary border-border-default',
  activating: 'bg-amber-subtle text-amber border-amber/30 animate-pulse-active',
  deactivating: 'bg-amber-subtle text-amber border-amber/30',
}

interface ServicesGridProps {
  services: ServiceInfo[]
  loading: boolean
  onAction: (service: ServiceInfo, action: 'start' | 'stop' | 'restart') => void | Promise<void>
}

function serviceStatusClass(status: string) {
  return STATUS_STYLES[status] ?? 'bg-bg-overlay text-text-secondary border-border-default'
}

function getActions(service: ServiceInfo): ('start' | 'stop' | 'restart')[] {
  if (service.forbidden) return []
  if (service.status === 'active') return ['restart', 'stop']
  if (service.status === 'inactive' || service.status === 'failed') return ['start']
  return ['restart', 'stop', 'start'] // transitional states — show all
}

export default function ServicesGrid({ services, loading, onAction }: ServicesGridProps) {
  if (loading && services.length === 0) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group} className="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-panel">
            <div className="mb-3 h-4 w-24 rounded bg-bg-overlay" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-28" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {GROUPS.map((group) => {
        const all = services.filter((s) => s.group === group)
        // Sort: active first, inactive/failed at bottom
        const items = [...all].sort((a, b) => {
          const rank = (s: string) => s === 'active' ? 0 : s === 'activating' ? 1 : s === 'failed' ? 2 : 3
          return rank(a.status) - rank(b.status)
        })
        return (
          <section key={group} className="rounded-lg border border-border-subtle bg-bg-surface p-4 shadow-panel">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">{group}</h2>
              <span className="rounded-full border border-border-subtle px-2 py-0.5 font-mono text-xs text-text-tertiary">
                {items.length}
              </span>
            </div>
            <div className="space-y-3">
              {items.length === 0 && (
                <EmptyState icon="○" title={`No ${group} services`} />
              )}
              {items.map((service) => {
                const isInactive = service.status === 'inactive'
                const isFailed = service.status === 'failed'
                const actions = getActions(service)

                return (
                  <article
                    key={service.name}
                    className={`group rounded-md border p-3 transition-colors ${
                      service.forbidden ? 'opacity-50 border-border-default bg-bg-void' :
                      isInactive ? 'opacity-60 border-l-2 border-l-red/40 border-border-default bg-bg-void' :
                      isFailed ? 'border-red/30 bg-bg-elevated animate-pulse-critical' :
                      service.status === 'active' ? 'border-emerald/20 bg-bg-elevated hover:bg-bg-hover animate-pulse-healthy' :
                      'border-border-default bg-bg-elevated hover:bg-bg-hover'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-text-primary truncate" title={service.display_name}>{service.display_name}</h3>
                          {service.forbidden && <span title="Protected — managed externally, actions disabled" className="cursor-help">🔒</span>}
                        </div>
                        <p className="mt-1 font-mono text-xs text-text-tertiary truncate" title={service.name}>{service.name}</p>
                      </div>
                      <span className={`shrink-0 rounded border px-2 py-1 font-mono text-xs ${serviceStatusClass(service.status)}`} style={{ borderRadius: '4px' }}>
                        {service.status}
                      </span>
                    </div>

                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <dt className="mb-1 font-mono uppercase tracking-wide text-text-tertiary">Uptime</dt>
                        <dd className="font-mono text-text-secondary">{service.uptime ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="mb-1 font-mono uppercase tracking-wide text-text-tertiary">Memory</dt>
                        <dd className="font-mono text-text-secondary">{service.memory_mb != null ? `${service.memory_mb} MB` : '—'}</dd>
                      </div>
                    </dl>

                    {/* Action buttons — contextual, hover-only */}
                    {actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {actions.map((action) => {
                          const needsConfirm = action === 'stop' || action === 'restart'
                          return (
                            <button
                              key={action}
                              type="button"
                              aria-label={`${action} ${service.display_name}`}
                              onClick={() => {
                                if (needsConfirm && !window.confirm(`${action} ${service.display_name}?`)) return
                                void onAction(service, action)
                              }}
                              className="rounded border border-border-subtle px-3 py-1 font-mono text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
                              style={{ borderRadius: '4px' }}
                            >
                              {action}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
