import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Task, PipelineState } from '../../src/lib/types'

/**
 * Coverage for #148 — filtered-empty state.
 *
 * When backend returns tasks but current filter hides all of them,
 * the page must show an explicit filtered-empty state with:
 *  - hidden-data context (count signal)
 *  - one-click recovery action ("Show all tasks")
 *
 * True zero-data state must remain distinct.
 *
 * NOTE: As of #160 the default preset is "All" with Hide empty on,
 * so filtered-empty only triggers after the user explicitly narrows
 * the filter (e.g. switching to Active when all tasks are DONE).
 */

// ─── DnD kit mocks ──────────────────────────────────────────────────────────

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: () => null,
  closestCorners: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}))

vi.mock('../../src/lib/api', () => ({
  fetchTasks: vi.fn(),
  createTask: vi.fn(),
  transitionTask: vi.fn(),
  fetchCurrentAgent: vi.fn().mockResolvedValue({ id: 'archimedes', name: 'Archimedes', emoji: '🔧', role: 'Engineer' }),
}))

vi.mock('../../src/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

vi.mock('../../src/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn() })),
}))

import Pipeline from '../../src/pages/Pipeline'
import { usePolling } from '../../src/hooks/usePolling'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDoneTask(id: string, owner = 'archimedes'): Task {
  return {
    id, state: 'DONE' as PipelineState, owner,
    route: 'build_route', title: `Done task ${id}`, age: 120, ttl: null,
    blockers: 0, retries: 0, terminal: true,
    hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  }
}

function makeActiveTask(id: string, state: PipelineState = 'EXECUTION', owner = 'archimedes'): Task {
  return {
    id, state, owner,
    route: 'build_route', title: `Active task ${id}`, age: 5, ttl: null,
    blockers: 0, retries: 0, terminal: false,
    hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  }
}

const allDoneTasks: Task[] = [
  makeDoneTask('tsk_d1', 'archimedes'),
  makeDoneTask('tsk_d2', 'sokrat'),
  makeDoneTask('tsk_d3', 'platon'),
]

const mixedTasks: Task[] = [
  makeActiveTask('tsk_a1', 'EXECUTION'),
  makeDoneTask('tsk_d1'),
  makeDoneTask('tsk_d2'),
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockPolling(data: Task[] | null, loading = false) {
  vi.mocked(usePolling).mockReturnValue({
    data, loading, error: null,
    refetch: vi.fn(), refresh: vi.fn(),
  })
}

/** Switch the board to Active preset so only active states are shown. */
function switchToActive() {
  fireEvent.click(screen.getByRole('button', { name: 'Active' }))
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Pipeline — filtered-empty state (#148)', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // ── Default is All (#160) — no filtered-empty on fresh load ───────────

  it('does NOT show filtered-empty state on fresh load when all tasks are DONE (default=All, #160)', () => {
    mockPolling(allDoneTasks)
    render(<Pipeline />)

    // Default is All — all DONE tasks are visible, no filtered-empty
    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  // ── All tasks DONE + user switches to Active filter ───────────────────

  it('shows filtered-empty state when user switches to Active and all tasks are DONE', () => {
    mockPolling(allDoneTasks)
    render(<Pipeline />)

    // Switch to Active — all DONE tasks are hidden
    switchToActive()

    const emptyState = screen.getByTestId('filtered-empty-state')
    expect(emptyState).toBeInTheDocument()
    expect(screen.getByText(/All 3 tasks are hidden by the current filter/)).toBeInTheDocument()
    expect(screen.getByText(/0 matching \/ 3 total/)).toBeInTheDocument()
  })

  it('filtered-empty state includes "Show all tasks" recovery button', () => {
    mockPolling(allDoneTasks)
    render(<Pipeline />)
    switchToActive()

    expect(screen.getByRole('button', { name: /show all tasks/i })).toBeInTheDocument()
  })

  it('"Show all tasks" reveals hidden tasks', () => {
    mockPolling(allDoneTasks)
    render(<Pipeline />)
    switchToActive()

    // Initially filtered-empty
    expect(screen.getByTestId('filtered-empty-state')).toBeInTheDocument()

    // Click recovery action
    fireEvent.click(screen.getByRole('button', { name: /show all tasks/i }))

    // Filtered-empty should be gone, tasks should be visible
    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
    // DONE column should now be visible with tasks
    expect(screen.getByText('Done task tsk_d1')).toBeInTheDocument()
  })

  it('"Show all tasks" sets the All preset as active', () => {
    mockPolling(allDoneTasks)
    render(<Pipeline />)
    switchToActive()

    fireEvent.click(screen.getByRole('button', { name: /show all tasks/i }))

    // Check localStorage was updated to All preset
    const stored = JSON.parse(localStorage.getItem('pipeline-filter-state')!)
    expect(stored.filters.stateGroup).toBe('all')
  })

  // ── True empty dataset ─────────────────────────────────────────────────

  it('does NOT show filtered-empty state when backend returns zero tasks', () => {
    mockPolling([])
    render(<Pipeline />)

    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('0 tasks')).toBeInTheDocument()
  })

  // ── Mixed dataset ──────────────────────────────────────────────────────

  it('does NOT show filtered-empty state when all tasks match default All filter', () => {
    mockPolling(mixedTasks)
    render(<Pipeline />)

    // Default is All (#160) — all 3 tasks visible, no filtered-empty
    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  // ── Persisted Active preset (version 2) ────────────────────────────────

  it('shows filtered-empty state when persisted Active preset (v2) hides all tasks', () => {
    // Simulate persisted Active preset in localStorage (version 2 required by #160)
    localStorage.setItem('pipeline-filter-state', JSON.stringify({
      version: 2,
      preset: 'active',
      filters: { owners: [], route: '', stateGroup: 'active' },
    }))
    mockPolling(allDoneTasks)
    render(<Pipeline />)

    expect(screen.getByTestId('filtered-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/All 3 tasks are hidden/)).toBeInTheDocument()
  })

  it('old localStorage (no version) is migrated to All default, no filtered-empty (#160)', () => {
    // Old persisted Active preset without version — should be migrated/cleared
    localStorage.setItem('pipeline-filter-state', JSON.stringify({
      preset: 'active',
      filters: { owners: [], route: '', stateGroup: 'active' },
    }))
    mockPolling(allDoneTasks)
    render(<Pipeline />)

    // Migration clears old state → defaults to All → no filtered-empty
    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('recovery works from persisted Active filter state', () => {
    localStorage.setItem('pipeline-filter-state', JSON.stringify({
      version: 2,
      preset: 'active',
      filters: { owners: [], route: '', stateGroup: 'active' },
    }))
    mockPolling(allDoneTasks)
    render(<Pipeline />)

    fireEvent.click(screen.getByRole('button', { name: /show all tasks/i }))

    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  // ── Loading state ──────────────────────────────────────────────────────

  it('does NOT show filtered-empty state during loading', () => {
    mockPolling(null, true)
    render(<Pipeline />)

    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
  })

  // ── Preset switching ───────────────────────────────────────────────────

  it('switching to Blocked preset shows filtered-empty state when no error tasks exist', () => {
    mockPolling(allDoneTasks)
    render(<Pipeline />)

    // Default is All — no filtered-empty yet
    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()

    // Switch to Blocked preset — no matching tasks
    fireEvent.click(screen.getByRole('button', { name: 'Blocked' }))
    expect(screen.getByTestId('filtered-empty-state')).toBeInTheDocument()
    expect(screen.getByText(/All 3 tasks are hidden/)).toBeInTheDocument()
  })

  it('switching to All from filtered-empty hides the empty state', () => {
    mockPolling(allDoneTasks)
    render(<Pipeline />)

    // Switch to Active to trigger filtered-empty
    switchToActive()
    expect(screen.getByTestId('filtered-empty-state')).toBeInTheDocument()

    // Click "All" preset button directly
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.queryByTestId('filtered-empty-state')).not.toBeInTheDocument()
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })
})
