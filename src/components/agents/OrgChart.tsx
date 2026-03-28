import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentInfo } from '../../lib/api'
import { fetchAgents } from '../../lib/api'
import OrgNode from './OrgNode'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'

interface OrgChartProps {
  onSelectAgent: (agent: AgentInfo) => void
}

function findRoot(agents: AgentInfo[]): AgentInfo | undefined {
  return (
    agents.find(a => a.role === 'orchestrator') ??
    agents.find(a => a.name === 'main') ??
    agents[0]
  )
}

/** Horizontal connector line constants */
const ROOT_W = 80
const ROOT_H = 100
const CHILD_R = 24 // child circle radius
const CHILD_ROW_H = 64 // vertical spacing per child
const GAP_X = 60 // horizontal gap between root edge and child centers

export default function OrgChart({ onSelectAgent }: OrgChartProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchAgents()
      setAgents(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [load])

  const handleSelect = useCallback(
    (agent: AgentInfo) => {
      setSelectedId(agent.id)
      onSelectAgent(agent)
    },
    [onSelectAgent],
  )

  if (error && agents.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <p className="text-red">{error}</p>
        <button onClick={load} className="mt-2 text-[11px] text-accent-amber hover:underline">
          Retry
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-8 py-8">
        <Skeleton className="w-20 h-[100px] rounded-md" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="w-12 h-12 rounded-full" />
          ))}
        </div>
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <EmptyState icon="◎" title="No agents found" description="No active agent sessions" />
    )
  }

  const root = findRoot(agents)!
  const children = agents.filter(a => a.id !== root.id)

  // --- Mobile vertical layout (< md) ---
  // --- Desktop horizontal layout (>= md) ---

  return (
    <div ref={containerRef}>
      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-3 md:hidden">
        <MobileTree
          root={root}
          children={children}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* Desktop: horizontal tree */}
      <div className="hidden md:block">
        <DesktopTree
          root={root}
          children={children}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
    </div>
  )
}

/* ── Desktop horizontal layout ─────────────────────────────────── */

function DesktopTree({
  root,
  children,
  selectedId,
  onSelect,
}: {
  root: AgentInfo
  children: AgentInfo[]
  selectedId: string | null
  onSelect: (a: AgentInfo) => void
}) {
  const childCount = children.length
  const treeH = Math.max(ROOT_H, childCount * CHILD_ROW_H)
  const rootY = treeH / 2
  const childStartX = ROOT_W + GAP_X
  const svgH = treeH + 16

  return (
    <div className="relative" style={{ minHeight: svgH }}>
      {/* SVG connections */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width="100%"
        height={svgH}
        style={{ overflow: 'visible' }}
      >
        {children.map((child, i) => {
          const cy = (i + 0.5) * CHILD_ROW_H + 8
          const isActive = child.status === 'active'
          const stroke = isActive ? '#22C55E' : '#403E3C'
          const strokeW = isActive ? 1.5 : 1
          const midX = ROOT_W + GAP_X / 2

          return (
            <g key={child.id}>
              {/* Horizontal from root → mid */}
              <line
                x1={ROOT_W}
                y1={rootY}
                x2={midX}
                y2={rootY}
                stroke={stroke}
                strokeWidth={strokeW}
              />
              {/* Vertical from mid → child row */}
              <line
                x1={midX}
                y1={rootY}
                x2={midX}
                y2={cy}
                stroke={stroke}
                strokeWidth={strokeW}
              />
              {/* Horizontal from mid → child */}
              <line
                x1={midX}
                y1={cy}
                x2={childStartX - CHILD_R - 4}
                y2={cy}
                stroke={stroke}
                strokeWidth={strokeW}
              />
              {/* Arrow head */}
              <polygon
                points={arrowHead(childStartX - CHILD_R - 4, cy, 'right')}
                fill={stroke}
              />
            </g>
          )
        })}
      </svg>

      {/* Root node */}
      <div className="absolute" style={{ top: rootY - ROOT_H / 2, left: 0 }}>
        <OrgNode
          agent={root}
          isRoot
          isSelected={selectedId === root.id}
          onClick={() => onSelect(root)}
        />
      </div>

      {/* Child nodes */}
      {children.map((child, i) => {
        const cy = (i + 0.5) * CHILD_ROW_H + 8
        return (
          <div
            key={child.id}
            className="absolute"
            style={{ top: cy - CHILD_R, left: childStartX - CHILD_R }}
          >
            <OrgNode
              agent={child}
              isRoot={false}
              isSelected={selectedId === child.id}
              onClick={() => onSelect(child)}
            />
          </div>
        )
      })}
    </div>
  )
}

/* ── Mobile vertical layout ────────────────────────────────────── */

function MobileTree({
  root,
  children,
  selectedId,
  onSelect,
}: {
  root: AgentInfo
  children: AgentInfo[]
  selectedId: string | null
  onSelect: (a: AgentInfo) => void
}) {
  return (
    <>
      <OrgNode
        agent={root}
        isRoot
        isSelected={selectedId === root.id}
        onClick={() => onSelect(root)}
      />
      <div className="relative ml-6 flex flex-col gap-2">
        {/* Vertical line */}
        <svg
          className="absolute left-0 top-0 pointer-events-none"
          width="24"
          height="100%"
          style={{ overflow: 'visible' }}
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2="100%"
            stroke="#403E3C"
            strokeWidth={1}
          />
        </svg>
        {children.map(child => {
          const isActive = child.status === 'active'
          return (
            <div key={child.id} className="relative pl-6">
              {/* Horizontal tick */}
              <svg
                className="absolute left-0 top-1/2 pointer-events-none"
                width="24"
                height="2"
                style={{ overflow: 'visible', transform: 'translateY(-50%)' }}
              >
                <line
                  x1={0}
                  y1={1}
                  x2={20}
                  y2={1}
                  stroke={isActive ? '#22C55E' : '#403E3C'}
                  strokeWidth={isActive ? 1.5 : 1}
                />
                <polygon
                  points={arrowHead(20, 1, 'right')}
                  fill={isActive ? '#22C55E' : '#403E3C'}
                />
              </svg>
              <OrgNode
                agent={child}
                isRoot={false}
                isSelected={selectedId === child.id}
                onClick={() => onSelect(child)}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ── Helpers ───────────────────────────────────────────────────── */

function arrowHead(tipX: number, tipY: number, direction: 'right' | 'down'): string {
  const size = 4
  if (direction === 'right') {
    return `${tipX},${tipY} ${tipX - size},${tipY - size / 2} ${tipX - size},${tipY + size / 2}`
  }
  return `${tipX},${tipY} ${tipX - size / 2},${tipY - size} ${tipX + size / 2},${tipY - size}`
}
