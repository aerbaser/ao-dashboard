import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Task, PipelineState } from '../../src/lib/types'

// Mock DnD kit — KanbanBoard uses these but DnD behaviour is KanbanBoard's responsibility
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

// Mock api
vi.mock('../../src/lib/api', () => ({
  fetchTasks: vi.fn(),
  createTask: vi.fn(),
  transitionTask: vi.fn(),
}))

// Mock usePolling to return controlled data
vi.mock('../../src/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

// Mock useToast used inside KanbanBoard
vi.mock('../../src/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ showToast: vi.fn() })),
}))

import Pipeline from '../../src/pages/Pipeline'
import { usePolling } from '../../src/hooks/usePolling'

const mockTasks: Task[] = [
  {
    id: 'tsk_001',
    state: 'EXECUTION' as PipelineState,
    owner: 'archimedes',
    route: 'build_route',
    title: 'Build feature X',
    age: 5,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    actors: [],
  },
  {
    id: 'tsk_002',
    state: 'DONE' as PipelineState,
    owner: 'sokrat',
    route: 'build_route',
    title: 'Deploy service Y',
    age: 120,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: true,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    actors: [],
  },
  {
    id: 'tsk_003',
    state: 'BLOCKED' as PipelineState,
    owner: 'platon',
    route: 'artifact_route',
    title: 'Design review blocked',
    age: 30,
    ttl: null,
    blockers: 1,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    actors: [],
  },
]

describe('Pipeline page (full Kanban)', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(usePolling).mockReturnValue({
      data: mockTasks,
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })
  })

  it('defaults stateGroup to active on mount', () => {
    render(<Pipeline />)
    // EXECUTION is an active state — should be visible
    expect(screen.getByText('EXECUTION')).toBeInTheDocument()
    // Build feature X is in EXECUTION (active) — should be visible
    expect(screen.getByText('Build feature X')).toBeInTheDocument()
    // DONE tasks should NOT appear with active default
    expect(screen.queryByText('Deploy service Y')).not.toBeInTheDocument()
  })

  it('renders all columns when stateGroup is set to all via localStorage', () => {
    localStorage.setItem('pipeline:stateGroup', 'all')
    render(<Pipeline />)
    expect(screen.getByText('EXECUTION')).toBeInTheDocument()
    expect(screen.getByText('DONE')).toBeInTheDocument()
    expect(screen.getByText('BLOCKED')).toBeInTheDocument()
  })

  it('displays task cards in correct columns when stateGroup=all', () => {
    localStorage.setItem('pipeline:stateGroup', 'all')
    render(<Pipeline />)
    expect(screen.getByText('Build feature X')).toBeInTheDocument()
    expect(screen.getByText('Deploy service Y')).toBeInTheDocument()
    expect(screen.getByText('Design review blocked')).toBeInTheDocument()
  })

  it('persists stateGroup selection to localStorage', () => {
    render(<Pipeline />)
    // Default 'active' should be saved
    expect(localStorage.getItem('pipeline:stateGroup')).toBe('active')
  })

  it('shows freshness indicator', () => {
    render(<Pipeline />)
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('shows Create Task button', () => {
    render(<Pipeline />)
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument()
  })

  it('shows task count in header', () => {
    render(<Pipeline />)
    expect(screen.getByText(/3 tasks/)).toBeInTheDocument()
  })
})
