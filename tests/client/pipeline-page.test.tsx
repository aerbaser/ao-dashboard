import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Task } from '../../src/lib/types'

// Mock api module
vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual('../../src/lib/api')
  return {
    ...actual,
    fetchTasks: vi.fn(),
    createTask: vi.fn(),
    transitionTask: vi.fn(),
  }
})

// Mock usePolling to return controlled data
vi.mock('../../src/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

// Mock KanbanBoard to avoid DnD complexity in unit tests
vi.mock('../../src/components/pipeline/KanbanBoard', () => ({
  KanbanBoard: ({ tasks, onCardClick, hideEmpty }: {
    tasks: Task[];
    onCardClick: (t: Task) => void;
    onRefresh: () => void;
    hideEmpty?: boolean;
  }) => (
    <div data-testid="kanban-board" data-hide-empty={hideEmpty}>
      {tasks.map((t) => (
        <div
          key={t.id}
          data-testid={`task-card-${t.id}`}
          data-state={t.state}
          data-owner={t.owner}
          data-route={t.route}
          onClick={() => onCardClick(t)}
        >
          {t.title}
        </div>
      ))}
    </div>
  ),
}))

// Mock TaskDetail
vi.mock('../../src/components/pipeline/TaskDetail', () => ({
  TaskDetail: ({ task, onClose }: { task: Task; onClose: () => void; onTransition: () => void }) => (
    <div data-testid="task-detail">
      <span data-testid="detail-title">{task.title}</span>
      <button data-testid="detail-close" onClick={onClose}>Close</button>
    </div>
  ),
}))

import Pipeline from '../../src/pages/Pipeline'
import { usePolling } from '../../src/hooks/usePolling'

const makeTasks: () => Task[] = () => [
  {
    id: 'tsk_001', state: 'EXECUTION', owner: 'sokrat', route: 'build_route',
    title: 'Build dashboard', age: 10, ttl: null, blockers: 0, retries: 0,
    terminal: false, hasQuality: false, hasOutcome: false, hasRelease: false,
  },
  {
    id: 'tsk_002', state: 'DONE', owner: 'leo', route: 'artifact_route',
    title: 'Design tokens', age: 120, ttl: null, blockers: 0, retries: 0,
    terminal: true, hasQuality: true, hasOutcome: true, hasRelease: false,
  },
  {
    id: 'tsk_003', state: 'BLOCKED', owner: 'sokrat', route: 'build_route',
    title: 'Fix CI', age: 5, ttl: null, blockers: 1, retries: 2,
    terminal: false, hasQuality: false, hasOutcome: false, hasRelease: false,
  },
]

describe('Pipeline page (full Kanban)', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePolling).mockReturnValue({
      data: makeTasks(),
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })
  })

  it('renders the Pipeline header and task count', () => {
    render(<Pipeline />)
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('renders the KanbanBoard with all tasks', () => {
    render(<Pipeline />)
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
    expect(screen.getByText('Build dashboard')).toBeInTheDocument()
    expect(screen.getByText('Design tokens')).toBeInTheDocument()
    expect(screen.getByText('Fix CI')).toBeInTheDocument()
  })

  it('renders freshness indicator', () => {
    render(<Pipeline />)
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('renders FilterBar with owner, route, and state group selects', () => {
    render(<Pipeline />)
    // Owner select has "All owners" plus unique owners
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBe(3) // owner, route, stateGroup
  })

  it('renders Create Task button', () => {
    render(<Pipeline />)
    expect(screen.getByText('+ Create Task')).toBeInTheDocument()
  })

  it('filters tasks by owner', () => {
    render(<Pipeline />)
    const ownerSelect = screen.getAllByRole('combobox')[0]

    // Filter to 'leo' — should show only Design tokens
    fireEvent.change(ownerSelect, { target: { value: 'leo' } })
    expect(screen.getByText('Design tokens')).toBeInTheDocument()
    expect(screen.queryByText('Build dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Fix CI')).not.toBeInTheDocument()
  })

  it('filters tasks by route', () => {
    render(<Pipeline />)
    const routeSelect = screen.getAllByRole('combobox')[1]

    fireEvent.change(routeSelect, { target: { value: 'artifact_route' } })
    expect(screen.getByText('Design tokens')).toBeInTheDocument()
    expect(screen.queryByText('Build dashboard')).not.toBeInTheDocument()
  })

  it('filters tasks by stateGroup=active shows only active states', () => {
    render(<Pipeline />)
    const stateGroupSelect = screen.getAllByRole('combobox')[2]

    fireEvent.change(stateGroupSelect, { target: { value: 'active' } })
    // EXECUTION is active, DONE and BLOCKED are not
    expect(screen.getByText('Build dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Design tokens')).not.toBeInTheDocument()
    expect(screen.queryByText('Fix CI')).not.toBeInTheDocument()
  })

  it('filters tasks by stateGroup=error shows only error states', () => {
    render(<Pipeline />)
    const stateGroupSelect = screen.getAllByRole('combobox')[2]

    fireEvent.change(stateGroupSelect, { target: { value: 'error' } })
    expect(screen.getByText('Fix CI')).toBeInTheDocument()
    expect(screen.queryByText('Build dashboard')).not.toBeInTheDocument()
    expect(screen.queryByText('Design tokens')).not.toBeInTheDocument()
  })

  it('clicking a task card opens TaskDetail', () => {
    render(<Pipeline />)
    fireEvent.click(screen.getByText('Build dashboard'))
    expect(screen.getByTestId('task-detail')).toBeInTheDocument()
    expect(screen.getByTestId('detail-title')).toHaveTextContent('Build dashboard')
  })

  it('closing TaskDetail removes it', () => {
    render(<Pipeline />)
    fireEvent.click(screen.getByText('Build dashboard'))
    expect(screen.getByTestId('task-detail')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('detail-close'))
    expect(screen.queryByTestId('task-detail')).not.toBeInTheDocument()
  })

  it('clicking Create Task opens CreateTaskModal', () => {
    render(<Pipeline />)
    fireEvent.click(screen.getByText('+ Create Task'))
    expect(screen.getByText('Create Task', { selector: 'h2' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Task title...')).toBeInTheDocument()
  })

  it('hideEmpty checkbox passes prop to KanbanBoard', () => {
    render(<Pipeline />)
    const checkbox = screen.getByLabelText('Hide empty')
    expect(screen.getByTestId('kanban-board')).toHaveAttribute('data-hide-empty', 'false')

    fireEvent.click(checkbox)
    expect(screen.getByTestId('kanban-board')).toHaveAttribute('data-hide-empty', 'true')
  })

  it('shows loading state when no data yet', () => {
    vi.mocked(usePolling).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })
    render(<Pipeline />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('usePolling is called with fetchTasks and 5000ms interval', () => {
    render(<Pipeline />)
    expect(usePolling).toHaveBeenCalledWith(expect.any(Function), 5000)
  })
})
