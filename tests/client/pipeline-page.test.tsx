import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('shows task count in header (active default)', () => {
    render(<Pipeline />)
    // Default stateGroup='active' → only EXECUTION (1/3 tasks)
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
  })

  it('counter shows filtered/total when stateGroup filter is active', () => {
    render(<Pipeline />)
    // Default is 'active' — only EXECUTION (1/3 tasks)
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
    // Change to 'all' — all 3 tasks visible
    const stateSelect = screen.getByDisplayValue('Active')
    fireEvent.change(stateSelect, { target: { value: 'all' } })
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('counter shows filtered/total when owner filter is active', async () => {
    const user = userEvent.setup()
    // Use stateGroup=all so owner filter is the only active filter
    localStorage.setItem('pipeline:stateGroup', 'all')
    render(<Pipeline />)
    // All 3 tasks visible initially
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
    // Open multi-select and select 'archimedes' (first option)
    await user.click(screen.getByTestId('multi-select-trigger'))
    const boxes = Array.from(screen.getByTestId('multi-select').querySelectorAll('input[type="checkbox"]'))
    await user.click(boxes[0]) // archimedes
    // Only 1 archimedes task → "1 / 3 tasks"
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
  })

  it('counter shows total when all filters are reset', () => {
    render(<Pipeline />)
    // Start with active filter (default) — 1/3 tasks
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
    // Reset to 'all' — 3 tasks (no filter active)
    const stateSelect = screen.getByDisplayValue('Active')
    fireEvent.change(stateSelect, { target: { value: 'all' } })
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('counter updates when stateGroup changes', () => {
    render(<Pipeline />)
    // Start at 'active' (default) — 1/3 tasks
    const stateSelect = screen.getByDisplayValue('Active')
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()

    // All states: all 3 tasks
    fireEvent.change(stateSelect, { target: { value: 'all' } })
    expect(screen.getByText('3 tasks')).toBeInTheDocument()

    // Terminal: only DONE (1 task)
    fireEvent.change(stateSelect, { target: { value: 'terminal' } })
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()

    // Error: only BLOCKED (1 task)
    fireEvent.change(stateSelect, { target: { value: 'error' } })
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
  })

  it('counter shows 0/total when stateGroup=active and all tasks are DONE', () => {
    const allDoneTasks: Task[] = Array.from({ length: 3 }, (_, i) => ({
      id: `tsk_done_${i}`,
      state: 'DONE' as PipelineState,
      owner: 'archimedes',
      route: 'build_route',
      title: `Done task ${i}`,
      age: 10,
      ttl: null,
      blockers: 0,
      retries: 0,
      terminal: true,
      hasQuality: false,
      hasOutcome: false,
      hasRelease: false,
      actors: [],
    }))

    vi.mocked(usePolling).mockReturnValue({
      data: allDoneTasks,
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })

    // Default is 'active' already — all tasks are DONE → 0/3
    render(<Pipeline />)
    expect(screen.getByText('0 / 3 tasks')).toBeInTheDocument()
  })

  it('shows owner multi-select in filter bar', () => {
    render(<Pipeline />)
    expect(screen.getByTestId('multi-select')).toBeInTheDocument()
    expect(screen.getByTestId('multi-select-trigger')).toHaveTextContent('All owners')
  })

  it('shows hide empty checkbox in filter bar (not header)', () => {
    render(<Pipeline />)
    const hideEmptyCheckbox = screen.getByRole('checkbox', { name: /hide empty/i })
    expect(hideEmptyCheckbox).toBeInTheDocument()
    // Should be unchecked by default
    expect(hideEmptyCheckbox).not.toBeChecked()
  })

  it('multi-owner filter shows tasks from all selected owners', async () => {
    const user = userEvent.setup()
    localStorage.setItem('pipeline:stateGroup', 'all')
    render(<Pipeline />)

    // Open multi-select dropdown
    await user.click(screen.getByTestId('multi-select-trigger'))

    // Select archimedes — checkboxes inside multi-select container
    const getDropdownBoxes = () =>
      Array.from(screen.getByTestId('multi-select').querySelectorAll('input[type="checkbox"]'))

    const boxes = getDropdownBoxes()
    // Owners sorted: archimedes, platon, sokrat
    expect(boxes).toHaveLength(3)

    // Select archimedes (dropdown stays open — click is inside ref)
    await user.click(boxes[0])

    // After selecting archimedes, only archimedes' task should be visible
    expect(screen.getByText('Build feature X')).toBeInTheDocument()
    expect(screen.queryByText('Deploy service Y')).not.toBeInTheDocument()

    // Dropdown still open, select sokrat too
    const boxes2 = getDropdownBoxes()
    await user.click(boxes2[2]) // sokrat

    // Now both archimedes and sokrat tasks should be visible
    expect(screen.getByText('Build feature X')).toBeInTheDocument()
    expect(screen.getByText('Deploy service Y')).toBeInTheDocument()
    // platon's task should still be hidden
    expect(screen.queryByText('Design review blocked')).not.toBeInTheDocument()
  })
})
