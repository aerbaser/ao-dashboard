import { useNavigate } from 'react-router-dom'
import type { GlobalStatus } from '../../lib/types'

interface TopBarProps {
  status: GlobalStatus | null
  onMenuToggle?: () => void
}

function StatusDot({ up }: { up: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        up
          ? 'bg-status-healthy animate-pulse-healthy'
          : 'bg-status-critical animate-pulse-critical'
      }`}
    />
  )
}

function Pill({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 bg-bg-elevated border border-border-subtle hover:bg-bg-hover transition-colors shrink-0 ${className}`}
    >
      {children}
    </button>
  )
}

function UsageBar({ label, percent }: { label: string; percent: number | null }) {
  if (percent === null) return null
  const color =
    percent > 85 ? 'bg-red' : percent > 60 ? 'bg-amber' : 'bg-status-healthy'
  return (
    <div className="flex items-center gap-1.5 min-w-[100px]">
      <span className="text-xs text-text-secondary whitespace-nowrap">{label}</span>
      <div className="flex-1 h-1.5 bg-bg-void rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-mono text-text-tertiary w-8 text-right">{percent}%</span>
    </div>
  )
}

function TempDisplay({ temp }: { temp: number | null }) {
  if (temp === null) return null
  const color =
    temp > 85 ? 'text-red' : temp > 70 ? 'text-amber' : 'text-text-secondary'
  return <span className={`text-xs font-mono ${color}`} title={`CPU temperature: ${temp}°C`}>CPU {temp}°C</span>
}

export default function TopBar({ status, onMenuToggle }: TopBarProps) {
  const navigate = useNavigate()

  return (
    <header className="h-[var(--topbar-height)] bg-bg-surface border-b border-border-subtle flex items-center px-3 gap-2 shrink-0 overflow-hidden">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuToggle}
        className="md:hidden flex items-center justify-center w-7 h-7 rounded text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
        aria-label="Toggle menu"
      >
        <span className="text-base leading-none">☰</span>
      </button>

      {/* Gateway pill */}
      <Pill onClick={() => navigate('/system')}>
        <StatusDot up={status?.gateway_up ?? false} />
        <span className="text-xs text-text-secondary">GW</span>
      </Pill>

      {/* Agents pill */}
      <Pill onClick={() => navigate('/agents')} className="hidden sm:flex">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          status && status.agents_alive > 0 ? 'bg-status-healthy animate-pulse-healthy' : 'bg-text-disabled'
        }`} />
        <span className="text-xs text-text-secondary">Agents</span>
        <span className="text-xs font-mono text-text-primary">
          {status ? `${status.agents_alive}/${status.agents_total}` : '—'}
        </span>
      </Pill>

      {/* Awaiting owner pill */}
      {status?.awaiting_owner_count != null && status.awaiting_owner_count > 0 && (
        <Pill onClick={() => navigate('/')} className="hidden sm:flex">
          {status?.awaiting_owner_overdue && (
            <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-red animate-pulse-critical" />
          )}
          <span className="text-xs text-amber">⏳ {status.awaiting_owner_count}</span>
        </Pill>
      )}

      {/* Active tasks pill */}
      <Pill onClick={() => navigate('/')} className="hidden sm:flex">
        <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
          status && status.active_tasks > 0 ? 'bg-amber animate-pulse-active' : 'bg-text-disabled'
        }`} />
        <span className="text-xs text-text-secondary">Active</span>
        <span className="text-xs font-mono text-text-primary">
          {status?.active_tasks ?? '—'}
        </span>
      </Pill>

      {/* Blocked tasks pill */}
      {status && status.blocked_tasks > 0 && (
        <Pill onClick={() => navigate('/')} className="hidden sm:flex">
          <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-red animate-pulse-critical" />
          <span className="text-xs text-red">Blocked</span>
          <span className="text-xs font-mono text-red">{status.blocked_tasks}</span>
        </Pill>
      )}

      <div className="flex-1" />

      {/* CPU pill */}
      <Pill onClick={() => navigate('/system')} className="hidden md:flex">
        <span className="text-xs text-text-secondary">CPU</span>
        <span className="text-xs font-mono text-text-primary">
          {status?.cpu_percent != null ? `${status.cpu_percent}%` : '—'}
        </span>
        <TempDisplay temp={status?.cpu_temp ?? null} />
      </Pill>

      {/* Usage bars */}
      <button
        onClick={() => navigate('/config')}
        className="hidden lg:flex items-center gap-3 hover:bg-bg-hover rounded-full px-3 py-1 transition-colors shrink-0"
      >
        <UsageBar label="Claude" percent={status?.claude_usage_percent ?? null} />
        <UsageBar label="Codex" percent={status?.codex_usage_percent ?? null} />
      </button>
    </header>
  )
}
