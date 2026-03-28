import { useState, useEffect, useCallback, useRef } from 'react'
import type { AgentInfo } from '../../lib/api'
import { fetchAgents } from '../../lib/api'
import OrgNode from './OrgNode'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'

interface OrgChartProps {
  onSelectAgent: (agent: AgentInfo) => void
}

const HIERARCHY: Record<string, string | null> = {
  sokrat: null,
  aristotle: 'sokrat',
  herodotus: 'sokrat',
  'brainstorm-claude': 'sokrat',
  'brainstorm-codex': 'sokrat',
  platon: 'sokrat',
  leo: 'platon',
  hephaestus: 'sokrat',
  archimedes: 'hephaestus',
}

interface TreeNode {
  agent: AgentInfo
  children: TreeNode[]
}

function buildTree(agents: AgentInfo[]): TreeNode | null {
  const rootId = Object.entries(HIERARCHY).find(([, parent]) => parent === null)?.[0]
  // Find root agent — by hierarchy id, or fallback to orchestrator role, or first agent
  const rootAgent = (rootId ? agents.find(a => a.id === rootId) : null)
    ?? agents.find(a => a.role === 'orchestrator' || a.role === 'Orchestrator')
    ?? agents[0]
  if (!rootAgent) return null

  function buildNode(agent: AgentInfo, allAgents: AgentInfo[]): TreeNode {
    // Children defined by HIERARCHY
    const hierarchyChildIds = Object.entries(HIERARCHY)
      .filter(([, parent]) => parent === agent.id)
      .map(([childId]) => childId)
    const hierarchyChildren = hierarchyChildIds
      .map(childId => allAgents.find(a => a.id === childId))
      .filter((a): a is AgentInfo => a != null)
      .map(a => buildNode(a, allAgents))
    return { agent, children: hierarchyChildren }
  }

  const tree = buildNode(rootAgent, agents)

  // Collect all agent ids rendered in the tree
  const renderedIds = new Set<string>()
  function collectIds(node: TreeNode) {
    renderedIds.add(node.agent.id)
    node.children.forEach(collectIds)
  }
  collectIds(tree)

  // Attach any agents not rendered as direct children of root
  const orphans = agents.filter(a => !renderedIds.has(a.id))
  for (const orphan of orphans) {
    tree.children.push({ agent: orphan, children: [] })
  }

  return tree
}

/** Layout constants */
const ROOT_W = 80
const ROOT_H = 100
const CHILD_DIAMETER = 48
const CHILD_R = CHILD_DIAMETER / 2
const CHILD_ROW_H = 80
const GAP_X = 80

function getSubtreeHeight(node: TreeNode): number {
  if (node.children.length === 0) return CHILD_ROW_H
  return node.children.reduce((sum, child) => sum + getSubtreeHeight(child), 0)
}

interface LayoutNode {
  node: TreeNode
  x: number
  y: number
  isRoot: boolean
}

function computeLayout(tree: TreeNode): LayoutNode[] {
  const result: LayoutNode[] = []

  function layout(node: TreeNode, x: number, yStart: number, isRoot: boolean): void {
    const h = getSubtreeHeight(node)
    const cy = yStart + h / 2
    result.push({ node, x, y: cy, isRoot })

    if (node.children.length > 0) {
      const childX = x + (isRoot ? ROOT_W : CHILD_DIAMETER) + GAP_X
      let childYStart = yStart
      for (const child of node.children) {
        layout(child, childX, childYStart, false)
        childYStart += getSubtreeHeight(child)
      }
    }
  }

  layout(tree, 0, 0, true)
  return result
}

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

  const tree = buildTree(agents)

  if (!tree) {
    return (
      <EmptyState icon="◎" title="No agents found" description="No active agent sessions" />
    )
  }

  return (
    <div ref={containerRef}>
      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-3 md:hidden">
        <MobileTree
          tree={tree}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      {/* Desktop: horizontal tree */}
      <div className="hidden md:block">
        <DesktopTree
          tree={tree}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>
    </div>
  )
}

/* ── Desktop horizontal layout ─────────────────────────────────── */

function DesktopTree({
  tree,
  selectedId,
  onSelect,
}: {
  tree: TreeNode
  selectedId: string | null
  onSelect: (a: AgentInfo) => void
}) {
  const layout = computeLayout(tree)

  const totalW = Math.max(...layout.map(l => l.x + (l.isRoot ? ROOT_W : CHILD_DIAMETER))) + 100
  const totalH = Math.max(...layout.map(l => l.y + (l.isRoot ? ROOT_H / 2 : CHILD_R))) + 20

  function drawLines(node: TreeNode, parentLayout?: LayoutNode): React.ReactNode[] {
    const lines: React.ReactNode[] = []
    const myLayout = layout.find(l => l.node === node)!

    if (parentLayout) {
      const pRightX = parentLayout.x + (parentLayout.isRoot ? ROOT_W : CHILD_DIAMETER)
      const midX = pRightX + GAP_X / 2
      const isActive = node.agent.status === 'active'
      const stroke = isActive ? '#22C55E' : '#403E3C'
      const strokeW = isActive ? 1.5 : 1
      lines.push(
        <g key={`line-${node.agent.id}`}>
          <line x1={pRightX} y1={parentLayout.y} x2={midX} y2={parentLayout.y} stroke={stroke} strokeWidth={strokeW} />
          <line x1={midX} y1={parentLayout.y} x2={midX} y2={myLayout.y} stroke={stroke} strokeWidth={strokeW} />
          <line x1={midX} y1={myLayout.y} x2={myLayout.x - CHILD_R - 4} y2={myLayout.y} stroke={stroke} strokeWidth={strokeW} />
          <polygon points={arrowHead(myLayout.x - CHILD_R - 4, myLayout.y, 'right')} fill={stroke} />
        </g>
      )
    }

    for (const child of node.children) {
      lines.push(...drawLines(child, myLayout))
    }
    return lines
  }

  return (
    <div className="relative" style={{ width: totalW, height: totalH }}>
      <svg
        className="absolute inset-0 pointer-events-none"
        width={totalW}
        height={totalH}
        style={{ overflow: 'visible' }}
      >
        {drawLines(tree)}
      </svg>

      {layout.map(({ node, x, y, isRoot }) => (
        <div
          key={node.agent.id}
          className="absolute"
          style={{
            left: x,
            top: y - (isRoot ? ROOT_H / 2 : CHILD_R),
          }}
        >
          <OrgNode
            agent={node.agent}
            isRoot={isRoot}
            isSelected={selectedId === node.agent.id}
            onClick={() => onSelect(node.agent)}
          />
        </div>
      ))}
    </div>
  )
}

/* ── Mobile vertical layout ────────────────────────────────────── */

function MobileTree({
  tree,
  selectedId,
  onSelect,
}: {
  tree: TreeNode
  selectedId: string | null
  onSelect: (a: AgentInfo) => void
}) {
  return <MobileTreeNode node={tree} selectedId={selectedId} onSelect={onSelect} depth={0} />
}

function MobileTreeNode({
  node,
  selectedId,
  onSelect,
  depth,
}: {
  node: TreeNode
  selectedId: string | null
  onSelect: (a: AgentInfo) => void
  depth: number
}) {
  const isActive = node.agent.status === 'active'
  const stroke = isActive ? '#22C55E' : '#403E3C'
  const strokeW = isActive ? 1.5 : 1

  return (
    <div className={depth > 0 ? 'relative pl-6' : ''}>
      {depth > 0 && (
        <svg
          className="absolute left-0 top-1/2 pointer-events-none"
          width="24"
          height="2"
          style={{ overflow: 'visible', transform: 'translateY(-50%)' }}
        >
          <line x1={0} y1={1} x2={20} y2={1} stroke={stroke} strokeWidth={strokeW} />
          <polygon points={arrowHead(20, 1, 'right')} fill={stroke} />
        </svg>
      )}
      <OrgNode
        agent={node.agent}
        isRoot={depth === 0}
        isSelected={selectedId === node.agent.id}
        onClick={() => onSelect(node.agent)}
      />
      {node.children.length > 0 && (
        <div className="relative ml-6 flex flex-col gap-2">
          <svg
            className="absolute left-0 top-0 pointer-events-none"
            width="24"
            height="100%"
            style={{ overflow: 'visible' }}
          >
            <line x1={0} y1={0} x2={0} y2="100%" stroke="#403E3C" strokeWidth={1} />
          </svg>
          {node.children.map(child => (
            <MobileTreeNode
              key={child.agent.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
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
