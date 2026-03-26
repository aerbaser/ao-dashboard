import type { AgentInfo } from '../../lib/api'
import AgentAvatar from './AgentAvatar'
import CopyButton from '../ui/CopyButton'

function relativeTime(isoString: string | null): string {
  if (!isoString) return 'No heartbeat'
  const diff = Date.now() - new Date(isoString).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const STATUS_STYLES: Record<string, { dot: string; ring: string; animation?: string }> = {
  active:  { dot: 'bg-status-active', ring: 'ring-status-active/30', animation: 'animate-pulse-active' },
  idle:    { dot: 'bg-status-healthy', ring: 'ring-status-healthy/20', animation: 'animate-pulse-healthy' },
  dead:    { dot: 'bg-status-critical', ring: 'ring-status-critical/30', animation: 'animate-pulse-critical' },
  waiting: { dot: 'bg-accent-purple', ring: 'ring-accent-purple/30' },
  unknown: { dot: 'bg-text-disabled', ring: 'ring-text-disabled/20' },
}

interface AgentCardProps {
  agent: AgentInfo
  onClick: () => void
}

export default function AgentCard({ agent, onClick }: AgentCardProps) {
  const style = STATUS_STYLES[agent.status] ?? STATUS_STYLES.unknown

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-bg-surface border border-border-default rounded-md p-3 hover:bg-bg-elevated transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-accent-amber/40"
    >
      <div className="flex items-start gap-3">
        <AgentAvatar name={agent.name} id={agent.id} status={agent.status} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary truncate">{agent.name}</span>
            <span className={`w-2 h-2 rounded-full shrink-0 ring-2 ${style.dot} ${style.ring} ${style.animation ?? ''}`} />
          </div>
          <div className="text-[11px] text-text-tertiary mt-0.5">{agent.role}</div>

          <div className="mt-2 space-y-1">
            <div className="text-[11px] font-mono text-text-secondary">
              {agent.last_seen
                ? relativeTime(agent.last_seen)
                : 'No heartbeat — status unknown'}
            </div>

            {agent.current_task_id && (
              <div className="text-[11px] font-mono text-text-tertiary truncate flex items-center gap-1">
                <span className="truncate">{agent.current_task_id}</span>
                <CopyButton text={agent.current_task_id} className="shrink-0" />
              </div>
            )}

            {agent.current_step && (
              <div className="text-[11px] text-text-secondary truncate">
                {agent.current_step}
              </div>
            )}

            <div className="flex items-center gap-1 mt-1">
              <span className="text-[11px] text-text-tertiary">
                {agent.checkpoint_safe === true ? '\u2705' : agent.checkpoint_safe === false ? '\u274C' : '\u2014'}
              </span>
            </div>
          </div>

          <div className="flex gap-1.5 mt-2">
            <MailBadge label="in" count={agent.mailbox.inbox} color="bg-accent-blue/20 text-text-tertiary" highlightColor="bg-amber-subtle text-amber font-semibold" />
            <MailBadge label="proc" count={agent.mailbox.processing} color="bg-accent-amber-subtle text-text-tertiary" />
            <MailBadge label="done" count={agent.mailbox.done} color="bg-accent-emerald-subtle text-text-tertiary" />
            <MailBadge label="dead" count={agent.mailbox.deadletter} color="bg-accent-red-subtle text-text-tertiary" highlightColor="bg-red-subtle text-red font-semibold" />
          </div>
        </div>
      </div>
    </button>
  )
}

function MailBadge({ label, count, color, highlightColor }: { label: string; count: number; color: string; highlightColor?: string }) {
  // Highlight non-zero inbox (amber) and deadletter (red)
  const active = count > 0 && highlightColor
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono ${active ? highlightColor : color}`}>
      {label}:{count}
    </span>
  )
}
