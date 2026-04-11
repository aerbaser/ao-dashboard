/**
 * Tests for proof visibility and reopen reason in TaskCard and TaskDetail.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { Task, ProofInfo } from '../../src/lib/types'

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {}, listeners: {}, setNodeRef: vi.fn(),
    transform: null, transition: undefined, isDragging: false,
  }),
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

let TaskCard: typeof import('../../src/components/pipeline/TaskCard').TaskCard

beforeAll(async () => {
  const mod = await import('../../src/components/pipeline/TaskCard')
  TaskCard = mod.TaskCard
})

afterEach(() => cleanup())

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_proof_test',
    state: 'MERGED_NOT_DEPLOYED',
    owner: 'archimedes',
    route: 'build_route',
    title: 'Test proof task',
    age: 30,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    proof: null,
    reopen_reason: null,
    ...overrides,
  }
}

describe('TaskCard — proof badge', () => {
  it('shows proof pending badge for verification state with pending proof', () => {
    const proof: ProofInfo = { required: true, status: 'pending' }
    render(<TaskCard task={makeTask({ proof })} onClick={vi.fn()} />)
    expect(screen.getByTestId('proof-badge')).toBeDefined()
    expect(screen.getByText(/Proof pending/)).toBeDefined()
  })

  it('shows proof passed badge for DONE with pass proof', () => {
    const proof: ProofInfo = { required: true, status: 'pass', evidence: 'screenshot.png' }
    render(<TaskCard task={makeTask({ state: 'DONE', proof })} onClick={vi.fn()} />)
    expect(screen.getByText(/Proof passed/)).toBeDefined()
  })

  it('shows proof failed badge', () => {
    const proof: ProofInfo = { required: true, status: 'fail' }
    render(<TaskCard task={makeTask({ state: 'LIVE_ACCEPTANCE', proof })} onClick={vi.fn()} />)
    expect(screen.getByText(/Proof failed/)).toBeDefined()
  })

  it('does not show proof badge when proof is null', () => {
    render(<TaskCard task={makeTask({ proof: null })} onClick={vi.fn()} />)
    expect(screen.queryByTestId('proof-badge')).toBeNull()
  })
})

describe('TaskCard — verification badge', () => {
  it('shows "Not yet verified" for MERGED_NOT_DEPLOYED', () => {
    render(<TaskCard task={makeTask({ state: 'MERGED_NOT_DEPLOYED' })} onClick={vi.fn()} />)
    expect(screen.getByTestId('verification-badge')).toBeDefined()
    expect(screen.getByText('Not yet verified')).toBeDefined()
  })

  it('shows "Not yet verified" for DEPLOYED_NOT_VERIFIED', () => {
    render(<TaskCard task={makeTask({ state: 'DEPLOYED_NOT_VERIFIED' })} onClick={vi.fn()} />)
    expect(screen.getByText('Not yet verified')).toBeDefined()
  })

  it('shows "Not yet verified" for LIVE_ACCEPTANCE', () => {
    render(<TaskCard task={makeTask({ state: 'LIVE_ACCEPTANCE' })} onClick={vi.fn()} />)
    expect(screen.getByText('Not yet verified')).toBeDefined()
  })

  it('does NOT show verification badge for DONE', () => {
    render(<TaskCard task={makeTask({ state: 'DONE' })} onClick={vi.fn()} />)
    expect(screen.queryByTestId('verification-badge')).toBeNull()
  })
})

describe('TaskCard — reopen reason', () => {
  it('shows reopen reason when present', () => {
    render(
      <TaskCard
        task={makeTask({ state: 'IN_SPEC', reopen_reason: 'Live proof failed — dashboard blank on mobile' })}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByTestId('reopen-reason')).toBeDefined()
    expect(screen.getByText(/Reopened:/)).toBeDefined()
  })

  it('does not show reopen reason when null', () => {
    render(<TaskCard task={makeTask({ reopen_reason: null })} onClick={vi.fn()} />)
    expect(screen.queryByTestId('reopen-reason')).toBeNull()
  })
})

describe('Legacy tasks — graceful handling', () => {
  it('renders legacy state without crash', () => {
    const legacyTask = makeTask({ state: 'EXECUTION', proof: null, reopen_reason: null })
    render(<TaskCard task={legacyTask} onClick={vi.fn()} />)
    expect(screen.getByText('Test proof task')).toBeDefined()
  })

  it('renders task with missing proof metadata without crash', () => {
    const task = makeTask({ state: 'EXECUTION', proof: undefined as unknown as null })
    render(<TaskCard task={task} onClick={vi.fn()} />)
    expect(screen.getByText('Test proof task')).toBeDefined()
  })
})
