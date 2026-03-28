import type { AgentInfo } from '../../lib/api'

const STATUS_DOT: Record<string, string> = {
  active:  'bg-accent-emerald',
  idle:    'bg-status-idle',
  dead:    'bg-status-critical',
  waiting: 'bg-accent-purple',
  unknown: 'bg-text-disabled',
}

interface OrgNodeProps {
  agent: AgentInfo
  isRoot: boolean
  isSelected: boolean
  onClick: () => void
}

export default function OrgNode({ agent, isRoot, isSelected, onClick }: OrgNodeProps) {
  const dotColor = STATUS_DOT[agent.status] ?? STATUS_DOT.unknown
  const isActive = agent.status === 'active'

  if (isRoot) {
    return (
      <button
        onClick={onClick}
        className={`relative flex flex-col items-center justify-center gap-1 rounded-md border bg-bg-elevated transition-colors duration-100 focus:outline-none focus:ring-1 focus:ring-accent-amber/40 ${
          isSelected ? 'border-accent-amber' : 'border-border-subtle'
        } ${isActive ? 'ring-1 ring-accent-amber/50 animate-pulse-active' : ''}`}
        style={{ width: 80, height: 100 }}
      >
        <span className="text-2xl leading-none">{agent.emoji}</span>
        <span className="text-[13px] font-semibold text-text-primary leading-tight text-center px-1 truncate w-full">
          {agent.name}
        </span>
        <span className="text-[10px] font-mono text-text-tertiary leading-tight truncate w-full text-center px-1">
          {agent.role}
        </span>
        <span
          className={`absolute bottom-1 right-1 rounded-full ${dotColor} ${isActive ? 'animate-pulse' : ''}`}
          style={{ width: 8, height: 8 }}
        />
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 group focus:outline-none ${
        isSelected ? 'opacity-100' : 'opacity-90 hover:opacity-100'
      }`}
    >
      <div
        className={`relative flex items-center justify-center rounded-full bg-bg-elevated border transition-colors duration-100 ${
          isSelected ? 'border-accent-amber' : 'border-border-subtle'
        } group-focus:ring-1 group-focus:ring-accent-amber/40`}
        style={{ width: 48, height: 48 }}
      >
        <span className="text-xl leading-none">{agent.emoji}</span>
        <span
          className={`absolute bottom-0 right-0 rounded-full ${dotColor} ${isActive ? 'animate-pulse' : ''}`}
          style={{ width: 6, height: 6 }}
        />
      </div>
      <div className="text-left">
        <span className={`text-[13px] font-semibold leading-tight ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
          {agent.name}
        </span>
        <span className="text-[10px] font-mono text-text-tertiary ml-1.5">
          {agent.role}
        </span>
      </div>
    </button>
  )
}
