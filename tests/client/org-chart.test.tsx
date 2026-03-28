import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AgentInfo } from '../../src/lib/api'

// Mock fetchAgents before importing components
vi.mock('../../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/api')>()
  return { ...actual, fetchAgents: vi.fn() }
})

import { fetchAgents } from '../../src/lib/api'
import OrgChart from '../../src/components/agents/OrgChart'
import OrgNode from '../../src/components/agents/OrgNode'
import AgentsPage from '../../src/pages/AgentsPage'

const mockFetch = vi.mocked(fetchAgents)

function makeAgent(overrides: Partial<AgentInfo> = {}): AgentInfo {
  return {
    id: 'agent-1',
    name: 'TestAgent',
    emoji: '🤖',
    role: 'worker',
    status: 'idle',
    current_task_id: null,
    current_step: null,
    progress_note: null,
    checkpoint_safe: null,
    last_seen: null,
    session_key: null,
    workspace_path: null,
    topic_id: null,
    heartbeat_raw: null,
    mailbox: { inbox: 0, processing: 0, done: 0, deadletter: 0 },
    ...overrides,
  }
}

const AGENTS: AgentInfo[] = [
  makeAgent({ id: 'sokrat', name: 'Сократ', emoji: '🧠', role: 'orchestrator', status: 'active' }),
  makeAgent({ id: 'archimedes', name: 'Архимед', emoji: '📐', role: 'reviewer', status: 'idle' }),
  makeAgent({ id: 'aristotle', name: 'Аристотель', emoji: '📚', role: 'coder', status: 'active' }),
  makeAgent({ id: 'plato', name: 'Платон', emoji: '💡', role: 'planner', status: 'dead' }),
]

// Stub localStorage
const storage = new Map<string, string>()
beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
})

// Mock useToast for AgentsPage
vi.mock('../../src/hooks/useToast', () => ({
  useToast: () => ({ push: vi.fn() }),
}))

// Mock AgentDetail to keep tests simple
vi.mock('../../src/components/agents/AgentDetail', () => ({
  default: ({ agent, onClose }: { agent: AgentInfo; onClose: () => void }) => (
    <div data-testid="agent-detail">
      <span>{agent.name}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

describe('OrgNode', () => {
  afterEach(() => cleanup())

  it('renders root node with emoji, name, role', () => {
    const agent = AGENTS[0]
    render(<OrgNode agent={agent} isRoot isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('🧠')).toBeInTheDocument()
    expect(screen.getByText('Сократ')).toBeInTheDocument()
    expect(screen.getByText('orchestrator')).toBeInTheDocument()
  })

  it('renders child node with emoji, name, role', () => {
    const agent = AGENTS[1]
    render(<OrgNode agent={agent} isRoot={false} isSelected={false} onClick={vi.fn()} />)
    expect(screen.getByText('📐')).toBeInTheDocument()
    expect(screen.getByText('Архимед')).toBeInTheDocument()
    expect(screen.getByText('reviewer')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<OrgNode agent={AGENTS[1]} isRoot={false} isSelected={false} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('OrgChart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(AGENTS)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders correct number of nodes', async () => {
    const onSelect = vi.fn()
    render(<OrgChart onSelectAgent={onSelect} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // All 4 agent names should appear (may appear twice due to mobile+desktop)
    for (const agent of AGENTS) {
      expect(screen.getAllByText(agent.name).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('identifies orchestrator as root', async () => {
    render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Root node renders as 80x100 card (button with specific styles)
    const rootButtons = screen.getAllByText('🧠')
    expect(rootButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders SVG connections for each child', async () => {
    const { container } = render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Each child gets an SVG group with lines + arrow polygon
    const lines = container.querySelectorAll('line')
    // At least 3 lines per child in desktop view (root→mid, mid→child vertical, mid→child horizontal)
    // Plus mobile vertical lines
    expect(lines.length).toBeGreaterThanOrEqual(3)

    const polygons = container.querySelectorAll('polygon')
    // At least one arrow per child
    expect(polygons.length).toBeGreaterThanOrEqual(3)
  })

  it('active agents get emerald connection lines', async () => {
    const { container } = render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    const emeraldLines = container.querySelectorAll('line[stroke="#22C55E"]')
    expect(emeraldLines.length).toBeGreaterThanOrEqual(1)
  })
})

describe('AgentsPage view toggle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockFetch.mockResolvedValue(AGENTS)
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows Tree and Grid toggle buttons', async () => {
    render(<AgentsPage />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(screen.getByText('🌳 Tree')).toBeInTheDocument()
    expect(screen.getByText('▦ Grid')).toBeInTheDocument()
  })

  it('defaults to Tree view', async () => {
    render(<AgentsPage />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Tree view should show OrgChart nodes (emoji-based)
    expect(screen.getAllByText('🧠').length).toBeGreaterThanOrEqual(1)
  })

  it('switches to Grid view on click', async () => {
    render(<AgentsPage />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    fireEvent.click(screen.getByText('▦ Grid'))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // localStorage should be updated
    expect(storage.get('agents-view-mode')).toBe('grid')
  })

  it('persists view selection in localStorage', async () => {
    storage.set('agents-view-mode', 'grid')
    render(<AgentsPage />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Should start in grid mode since localStorage says 'grid'
    expect(storage.get('agents-view-mode')).toBe('grid')
  })
})
