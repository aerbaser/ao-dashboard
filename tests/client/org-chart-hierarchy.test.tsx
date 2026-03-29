import { render, screen, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AgentInfo } from '../../src/lib/api'

// Mock fetchAgents before importing components
vi.mock('../../src/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/api')>()
  return { ...actual, fetchAgents: vi.fn() }
})

import { fetchAgents } from '../../src/lib/api'
import OrgChart from '../../src/components/agents/OrgChart'

const mockFetch = vi.mocked(fetchAgents)

vi.mock('../../src/hooks/useToast', () => ({
  useToast: () => ({ push: vi.fn() }),
}))

vi.mock('../../src/components/agents/AgentDetail', () => ({
  default: ({ agent, onClose }: { agent: AgentInfo; onClose: () => void }) => (
    <div data-testid="agent-detail">
      <span>{agent.name}</span>
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

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

// 9 agents matching the AGENT_META ids in server/api/agents.js
const AGENTS: AgentInfo[] = [
  makeAgent({ id: 'sokrat',            name: 'Сократ',           emoji: '🦉', role: 'Orchestrator', status: 'active' }),
  makeAgent({ id: 'archimedes',        name: 'Архимед',          emoji: '🔧', role: 'Engineer',        status: 'idle' }),
  makeAgent({ id: 'aristotle',         name: 'Аристотель',       emoji: '📚', role: 'Researcher',      status: 'idle' }),
  makeAgent({ id: 'herodotus',         name: 'Геродот',          emoji: '📜', role: 'Chronicler',      status: 'idle' }),
  makeAgent({ id: 'platon',            name: 'Платон',           emoji: '🏛️', role: 'Architect',       status: 'idle' }),
  makeAgent({ id: 'hephaestus',        name: 'Гефест',           emoji: '⚒️', role: 'Infrastructure',  status: 'idle' }),
  makeAgent({ id: 'brainstorm-claude', name: 'Brainstorm Claude', emoji: '🧠', role: 'Brainstorm',      status: 'idle' }),
  makeAgent({ id: 'brainstorm-codex',  name: 'Brainstorm Codex',  emoji: '💡', role: 'Brainstorm',      status: 'idle' }),
  makeAgent({ id: 'leo',               name: 'Лео',              emoji: '🎨', role: 'Designer',         status: 'idle' }),
]

const storage = new Map<string, string>()
beforeEach(() => {
  storage.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k),
  })
  vi.useFakeTimers()
  mockFetch.mockResolvedValue(AGENTS)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('OrgChart hierarchy', () => {
  it('renders all 9 agents', async () => {
    render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    for (const agent of AGENTS) {
      expect(screen.getAllByText(agent.name).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('Лео is child of Платон', async () => {
    render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // In the mobile tree (MobileTreeNode), Платон's wrapper div (class "relative pl-6")
    // contains its children subtree, which includes Лео at depth 2.
    // Find the mobile-tree instance of "Платон" (it has a closest .pl-6 ancestor).
    const platonEl = screen.getAllByText('Платон').find(
      el => el.closest('[class*="pl-6"]') !== null,
    )
    expect(platonEl).toBeDefined()

    const platonWrapper = platonEl!.closest('[class*="pl-6"]')
    expect(platonWrapper?.textContent).toContain('Лео')
  })

  it('Архимед is child of Гефест', async () => {
    render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Гефест is at depth 1, its .pl-6 wrapper contains Архимед at depth 2.
    const hephaestusEl = screen.getAllByText('Гефест').find(
      el => el.closest('[class*="pl-6"]') !== null,
    )
    expect(hephaestusEl).toBeDefined()

    const hephaestusWrapper = hephaestusEl!.closest('[class*="pl-6"]')
    expect(hephaestusWrapper?.textContent).toContain('Архимед')
  })

  it('Сократ is root (rendered as root card)', async () => {
    render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // Root OrgNode renders as a button with inline style { width: 96, height: 100 }
    const rootButton = screen.getAllByRole('button').find(
      b => b.style.width === '96px',
    )
    expect(rootButton).toBeDefined()
    expect(rootButton!.textContent).toContain('Сократ')
  })

  it('orphan agents attach to root and render', async () => {
    const agentsWithOrphan = [
      ...AGENTS,
      makeAgent({ id: 'mystery-agent', name: 'Mystery', emoji: '❓', role: 'unknown', status: 'idle' }),
    ]
    mockFetch.mockResolvedValue(agentsWithOrphan)

    render(<OrgChart onSelectAgent={vi.fn()} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    // mystery-agent is not in HIERARCHY so it becomes an orphan and is attached
    // as a direct child of the root node
    expect(screen.getAllByText('Mystery').length).toBeGreaterThanOrEqual(1)
  })
})
