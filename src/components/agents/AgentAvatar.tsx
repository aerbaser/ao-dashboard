/**
 * AgentAvatar — 40px circle with colored background, centered initial, status dot overlay.
 */

// Agent-specific identity colors — intentionally hardcoded per Leo's design spec.
// These are unique per-agent brand colors, not part of the reusable design token system.
const AGENT_COLORS: Record<string, string> = {
  sokrat:    '#3B82F6', // blue
  archimedes:'#F97316', // orange
  aristotle: '#A78BFA', // purple
  herodotus: '#22C55E', // green
  platon:    '#6366F1', // indigo
  hephaestus:'#EF4444', // red
  leo:       '#FBBF24', // yellow
  brainstorm:'#14B8A6', // teal
  'brainstorm-claude': '#14B8A6',
  'brainstorm-codex':  '#0D9488',
}

const STATUS_DOT: Record<string, string> = {
  active:  'bg-status-healthy',
  idle:    'bg-status-idle',
  dead:    'bg-status-critical',
  waiting: 'bg-accent-purple',
  unknown: 'bg-text-disabled',
}

interface AgentAvatarProps {
  name: string
  id: string
  status: string
  size?: number
}

export default function AgentAvatar({ name, id, status, size = 40 }: AgentAvatarProps) {
  const bg = AGENT_COLORS[id] ?? AGENT_COLORS[id.toLowerCase()] ?? '#6B7280'
  const initial = (name || id || '?')[0].toUpperCase()
  const dotClass = STATUS_DOT[status] ?? STATUS_DOT.unknown
  const dotSize = Math.round(size * 0.25) // 10px at 40px

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Circle with initial */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center font-semibold text-white select-none"
        style={{ backgroundColor: bg, fontSize: size * 0.45 }}
      >
        {initial}
      </div>
      {/* Status dot overlay — bottom-right */}
      <span
        className={`absolute rounded-full border-2 border-bg-surface ${dotClass}`}
        style={{
          width: dotSize,
          height: dotSize,
          bottom: -1,
          right: -1,
        }}
      />
    </div>
  )
}
