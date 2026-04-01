import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Task, PipelineState } from '../../src/lib/types'

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

// Mock api
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

const mockTasks: Task[] = [
  {
    id: 'tsk_001', state: 'EXECUTION' as PipelineState, owner: 'archimedes',
    route: 'build_route', title: 'Build feature X', age: 5, ttl: null,
    blockers: 0, retries: 0, terminal: false, hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  },
  {
    id: 'tsk_002', state: 'DONE' as PipelineState, owner: 'sokrat',
    route: 'build_route', title: 'Deploy service Y', age: 120, ttl: null,
    blockers: 0, retries: 0, terminal: true, hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  },
  {
    id: 'tsk_003', state: 'BLOCKED' as PipelineState, owner: 'platon',
    route: 'artifact_route', title: 'Design review blocked', age: 30, ttl: null,
    blockers: 1, retries: 0, terminal: false, hasQuality: false, hasOutcome: false, hasRelease: false, actors: [],
  },
]

const STORAGE_KEY = 'pipeline-filter-state'

describe('Pipeline presets & localStorage', () => {
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

  it('renders 4 preset buttons', () => {
    render(<Pipeline />)
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mine' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Blocked' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
  })

  it('clicking Active preset filters to active tasks', () => {
    render(<Pipeline />)
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    // EXECUTION is active, DONE is terminal, BLOCKED is error → only 1 active
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
  })

  it('clicking Blocked preset filters to error/blocked tasks', () => {
    render(<Pipeline />)
    fireEvent.click(screen.getByRole('button', { name: 'Blocked' }))
    // BLOCKED is in ERROR_STATES → 1 match
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
  })

  it('clicking All preset shows all tasks', () => {
    render(<Pipeline />)
    // First apply a filter
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
    // Then reset with All
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getByText('3 tasks')).toBeInTheDocument()
  })

  it('active preset is visually highlighted', () => {
    render(<Pipeline />)
    const activeBtn = screen.getByRole('button', { name: 'Active' })
    fireEvent.click(activeBtn)
    expect(activeBtn.className).toContain('bg-amber')
    expect(activeBtn.className).toContain('text-text-inverse')
  })

  it('manual filter change clears active preset and shows custom', () => {
    render(<Pipeline />)
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    // Verify preset is active
    expect(screen.getByRole('button', { name: 'Active' }).className).toContain('bg-amber')

    // Change route filter manually (owner now uses MultiSelect, route still uses <select>)
    const routeSelect = screen.getByDisplayValue('All routes')
    fireEvent.change(routeSelect, { target: { value: 'build_route' } })

    // Preset should be cleared, "custom" label appears
    expect(screen.getByText('custom')).toBeInTheDocument()
    // Active button should no longer be highlighted
    expect(screen.getByRole('button', { name: 'Active' }).className).not.toContain('bg-amber')
  })

  it('saves filter state to localStorage', () => {
    render(<Pipeline />)
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.preset).toBe('active')
    expect(stored.filters.stateGroup).toBe('active')
  })

  it('localStorage save/restore round-trip', () => {
    // Render and select a preset
    const { unmount } = render(<Pipeline />)
    fireEvent.click(screen.getByRole('button', { name: 'Blocked' }))

    // Verify saved
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.preset).toBe('blocked')
    expect(stored.filters.stateGroup).toBe('error')
    expect(stored.filters.owners).toEqual([])

    // Unmount and re-render — should restore from localStorage
    unmount()
    render(<Pipeline />)

    // The Blocked preset should be active again
    expect(screen.getByRole('button', { name: 'Blocked' }).className).toContain('bg-amber')
    // Should show filtered count (1 blocked task)
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
  })

  it('restores custom filters from localStorage', () => {
    // Pre-seed localStorage with custom filter state (version 2 required for migration, issue #160)
    const customState = {
      version: 2,
      preset: null,
      filters: { owners: ['archimedes'], route: '', stateGroup: 'all' as const },
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customState))

    render(<Pipeline />)

    // Should show custom label (no preset active)
    expect(screen.getByText('custom')).toBeInTheDocument()
    // Should filter to archimedes only (1 task)
    expect(screen.getByText('1 / 3 tasks')).toBeInTheDocument()
  })
})
