import { useNavigate } from 'react-router-dom'
import type { GlobalStatus } from '../../lib/types'

interface TopBarProps {
  status: GlobalStatus | null
  onMenuToggle?: () => void
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

export default function TopBar({ status, onMenuToggle }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header
      className="h-[var(--topbar-height)] bg-bg-surface border-b border-border-subtle flex items-center px-3 gap-2 shrink-0 overflow-hidden"
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden flex items-center justify-center w-7 h-7 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
        aria-label="Toggle menu"
      >
        <span className="text-base leading-none">☰</span>
      </button>

      {/* Gateway */}
      <button
        onClick={() => navigate('/system')}
        className="flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors shrink-0"
      >
        <StatusDot up={status?.gateway_up ?? false} />
        <span className="text-xs text-text-secondary">GW</span>
      </button>

      {/* Agents */}
      <button
        onClick={() => navigate('/agents')}
        className="hidden sm:flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors shrink-0"
      >
        <span className="text-xs text-text-secondary">
          Agents {status ? `${status.agents_alive}/${status.agents_total}` : '—'}
        </span>
      </button>

      {/* Active tasks */}
      <button
        onClick={() => navigate('/')}
        className="hidden sm:flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors shrink-0"
      >
        <span className="text-xs text-text-secondary">
          Active {status?.active_tasks ?? '—'}
        </span>
      </button>

      {/* Blocked tasks */}
      <button
        onClick={() => navigate('/')}
        className="hidden sm:flex items-center gap-1.5 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors shrink-0"
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
        className="hidden md:flex items-center gap-2 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors shrink-0"
      >
        <span className="text-xs text-text-secondary">
          CPU {status?.cpu_percent != null ? `${status.cpu_percent}%` : '—'}
        </span>
        <TempDisplay temp={status?.cpu_temp ?? null} />
      </button>

      {/* Usage bars */}
      <button
        onClick={() => navigate('/config')}
        className="hidden lg:flex items-center gap-3 hover:bg-bg-hover rounded px-1.5 py-1 transition-colors shrink-0"
      >
        <UsageBar label="Claude" percent={status?.claude_usage_percent ?? null} />
        <UsageBar label="Codex" percent={status?.codex_usage_percent ?? null} />
      </button>
    </header>
  )
}
