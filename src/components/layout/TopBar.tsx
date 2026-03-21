import { useNavigate } from 'react-router-dom'
import type { GlobalStatus } from '../../lib/types'

interface TopBarProps {
  status: GlobalStatus | null
}

function StatusDot({ up }: { up: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        up
          ? 'bg-status-healthy animate-pulse-active'
          : 'bg-status-critical animate-pulse-critical'
      }`}
    />
  )
}

function UsageBar({ label, percent }: { label: string; percent: number | null }) {
  if (percent === null) return null
  const color =
    percent > 85 ? 'bg-accent-red' : percent > 60 ? 'bg-accent-amber' : 'bg-status-healthy'
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <span className="text-xs text-text-secondary whitespace-nowrap">{label}</span>
      <div className="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-text-tertiary w-8 text-right">{percent}%</span>
    </div>
  )
}

function TempDisplay({ temp }: { temp: number | null }) {
  if (temp === null) return null
  const color =
    temp > 85 ? 'text-accent-red' : temp > 70 ? 'text-accent-amber' : 'text-text-secondary'
  return <span className={`text-xs ${color}`}>{temp}°C</span>
}

export default function TopBar({ status }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header
      className="h-[var(--topbar-height)] bg-bg-surface border-b border-border-subtle flex items-center px-4 gap-4 shrink-0"
    >
      {/* Gateway */}
      <button
        onClick={() => navigate('/system')}
        className="flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors"
      >
        <StatusDot up={status?.gateway_up ?? false} />
        <span className="text-xs text-text-secondary">GW</span>
      </button>

      {/* Agents */}
      <button
        onClick={() => navigate('/agents')}
        className="flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors"
      >
        <span className="text-xs text-text-secondary">
          Agents {status ? `${status.agents_alive}/${status.agents_total}` : '—'}
        </span>
      </button>

      {/* Active tasks */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors"
      >
        <span className="text-xs text-text-secondary">
          Active {status?.active_tasks ?? '—'}
        </span>
      </button>

      {/* Blocked tasks */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors"
      >
        <span
          className={`text-xs ${
            status && status.blocked_tasks > 0 ? 'text-accent-amber' : 'text-text-secondary'
          }`}
        >
          Blocked {status?.blocked_tasks ?? '—'}
        </span>
      </button>

      <div className="flex-1" />

      {/* CPU */}
      <button
        onClick={() => navigate('/system')}
        className="flex items-center gap-2 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors"
      >
        <span className="text-xs text-text-secondary">
          CPU {status?.cpu_percent != null ? `${status.cpu_percent}%` : '—'}
        </span>
        <TempDisplay temp={status?.cpu_temp ?? null} />
      </button>

      {/* Usage bars */}
      <button
        onClick={() => navigate('/config')}
        className="flex items-center gap-3 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors"
      >
        <UsageBar label="Claude" percent={status?.claude_usage_percent ?? null} />
        <UsageBar label="Codex" percent={status?.codex_usage_percent ?? null} />
      </button>
    </header>
  )
}
