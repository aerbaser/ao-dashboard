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
        const items = services.filter((service) => service.group === group)
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
              {items.map((service) => (
                <article
                  key={service.name}
                  className={`rounded-md border border-border-default bg-bg-elevated p-3 transition-colors ${
                    service.forbidden ? 'opacity-60' : 'hover:bg-bg-hover'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-primary">{service.display_name}</h3>
                        {service.forbidden && <span title="Forbidden service">🚫</span>}
                      </div>
                      <p className="mt-1 font-mono text-xs text-text-tertiary">{service.name}</p>
                    </div>
                    <span className={`rounded-sm border px-2 py-1 font-mono text-xs ${serviceStatusClass(service.status)}`}>
                      {service.status}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="mb-1 font-mono uppercase tracking-wide text-text-tertiary">Uptime</dt>
                      <dd className="text-text-secondary">{service.uptime}</dd>
                    </div>
                    <div>
                      <dt className="mb-1 font-mono uppercase tracking-wide text-text-tertiary">Memory</dt>
                      <dd className="text-text-secondary">{service.memory_mb} MB</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(['restart', 'stop', 'start'] as const).map((action) => {
                      const disabled = service.forbidden
                      const needsConfirm = action === 'stop' || action === 'restart'
                      return (
                        <button
                          key={action}
                          type="button"
                          disabled={disabled}
                          aria-label={`${action} ${service.display_name}`}
                          onClick={() => {
                            if (disabled) return
                            if (needsConfirm && !window.confirm(`${action} ${service.display_name}?`)) return
                            void onAction(service, action)
                          }}
                          className="rounded-sm border border-border-subtle px-3 py-1.5 font-mono text-xs text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                        >
                          {action}
                        </button>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
