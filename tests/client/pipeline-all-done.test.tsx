import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Task, PipelineState } from '../../src/lib/types'

/**
 * Regression coverage for #149 — pipeline trust regression.
 * All tasks DONE / no active tasks scenario must render without crash.
 * Empty Kanban board must not look broken.
 */

// Mock DnD kit
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

const allDoneTasks: Task[] = [
  {
    id: 'tsk_001', state: 'DONE' as PipelineState, owner: 'archimedes',
    route: 'build_route', title: 'Completed task A', age: 120, ttl: null,
    blockers: 0, retries: 0, terminal: true, hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  },
  {
    id: 'tsk_002', state: 'DONE' as PipelineState, owner: 'sokrat',
    route: 'build_route', title: 'Completed task B', age: 200, ttl: null,
    blockers: 0, retries: 0, terminal: true, hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  },
  {
    id: 'tsk_003', state: 'DONE' as PipelineState, owner: 'platon',
    route: 'artifact_route', title: 'Completed task C', age: 300, ttl: null,
    blockers: 0, retries: 0, terminal: true, hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  },
]

describe('Pipeline — all tasks DONE / empty active view regression', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders without crash when all tasks are DONE', () => {
    vi.mocked(usePolling).mockReturnValue({
      data: allDoneTasks,
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })

    render(<Pipeline />)
    // Default stateGroup is 'all' (issue #160), so all 3 DONE tasks are visible
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('All preset shows 3 tasks when all are DONE (no crash)', () => {
    vi.mocked(usePolling).mockReturnValue({
      data: allDoneTasks,
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })

    render(<Pipeline />)
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('Blocked preset shows 0 tasks when all are DONE (no crash)', () => {
    vi.mocked(usePolling).mockReturnValue({
      data: allDoneTasks,
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })

    render(<Pipeline />)
    fireEvent.click(screen.getByRole('button', { name: 'Blocked' }))
    expect(screen.getByText('0 / 3 tasks')).toBeInTheDocument()
  })

  it('renders without crash when task list is empty', () => {
    vi.mocked(usePolling).mockReturnValue({
      data: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })

    render(<Pipeline />)
    expect(screen.getByText('0 tasks')).toBeInTheDocument()
  })

  it('renders loading state without crash', () => {
    vi.mocked(usePolling).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })

    render(<Pipeline />)
    // Should not throw — loading state is handled
  })
})
