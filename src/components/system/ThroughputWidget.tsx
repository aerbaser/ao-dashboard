import type { ThroughputStats } from '../../lib/types'

interface ThroughputWidgetProps {
  data: ThroughputStats | null
  loading: boolean
}

function formatCycleTime(minutes: number): string {
  if (minutes === 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}

function trendBadge(trend: ThroughputStats['backlog_trend']) {
  switch (trend) {
    case 'shrinking':
      return 'bg-status-healthy/10 text-status-healthy border-status-healthy/30'
    case 'growing':
      return 'bg-status-critical/10 text-status-critical border-status-critical/30'
    default:
      return 'bg-status-info/10 text-status-info border-status-info/30'
  }
}

function trendLabel(trend: ThroughputStats['backlog_trend']) {
  switch (trend) {
    case 'shrinking': return 'Shrinking'
    case 'growing': return 'Growing'
    default: return 'Stable'
  }
}

export default function ThroughputWidget({ data, loading }: ThroughputWidgetProps) {
  if (loading && !data) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-sm text-text-tertiary">
        Loading throughput…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-sm text-text-tertiary">
        Throughput unavailable.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface shadow-panel">
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Pipeline Throughput</h2>
          <p className="mt-1 text-xs text-text-tertiary">
            Completion rate and cycle time across task pipeline.
          </p>
        </div>
        <span className={`rounded-sm border px-2 py-1 font-mono text-xs ${trendBadge(data.backlog_trend)}`}>
          {trendLabel(data.backlog_trend)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-3 text-center" data-testid="throughput-24h">
          <div className="font-mono text-2xl font-bold text-text-primary">
            {data.completed_24h}
          </div>
          <div className="mt-1 text-xs text-text-tertiary">Completed 24h</div>
        </div>

        <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-3 text-center" data-testid="throughput-cycle">
          <div className="font-mono text-2xl font-bold text-text-primary">
            {formatCycleTime(data.avg_cycle_time_minutes)}
          </div>
          <div className="mt-1 text-xs text-text-tertiary">Avg cycle time</div>
        </div>

        <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-3 text-center" data-testid="throughput-7d">
          <div className="font-mono text-2xl font-bold text-text-primary">
            {data.completed_7d}
          </div>
          <div className="mt-1 text-xs text-text-tertiary">Completed 7d</div>
        </div>
      </div>
    </div>
  )
}
