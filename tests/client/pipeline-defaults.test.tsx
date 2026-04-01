/**
 * Tests for Pipeline page defaults (issue #160):
 * - Fresh load defaults to preset "All"
 * - Hide empty defaults to enabled
 * - Old localStorage (version < 2) is migrated/ignored
 * - DONE column sorts newest-first
 */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { Task, PipelineState } from '../../src/lib/types'

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock API calls
vi.mock('../../src/lib/api', () => ({
  fetchTasks: vi.fn(() => Promise.resolve([])),
  createTask: vi.fn(),
  fetchCurrentAgent: vi.fn(() => Promise.resolve({ id: 'archimedes' })),
}))

// Mock usePolling to return tasks synchronously
const mockTasks: Task[] = []
vi.mock('../../src/hooks/usePolling', () => ({
  usePolling: vi.fn(() => ({
    data: mockTasks,
    loading: false,
    refresh: vi.fn(),
  })),
}))

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCorners: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  useDroppable: vi.fn(() => ({ setNodeRef: vi.fn(), isOver: false })),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  verticalListSortingStrategy: {},
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
  CSS: { Transform: { toString: () => undefined } },
}))

// Mock useToast
vi.mock('../../src/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ push: vi.fn() })),
}))

import Pipeline from '../../src/pages/Pipeline'

const STORAGE_KEY = 'pipeline-filter-state'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test',
    state: 'EXECUTION' as PipelineState,
    owner: 'archimedes',
    route: 'build_route',
    title: 'Test task',
    age: 10,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    actors: [],
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Pipeline defaults (issue #160)', () => {
  beforeEach(() => {
    localStorage.clear()
    mockTasks.length = 0
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('defaults to "All" preset on fresh load (no localStorage)', () => {
    render(<Pipeline />)
    // The "All" button should have the active style (bg-amber)
    const allBtn = screen.getByRole('button', { name: 'All' })
    expect(allBtn.className).toContain('bg-amber')
    // The "Active" button should NOT be active
    const activeBtn = screen.getByRole('button', { name: 'Active' })
    expect(activeBtn.className).not.toContain('bg-amber')
  })

  it('defaults to "All states" in the state group dropdown on fresh load', () => {
    render(<Pipeline />)
    // The state group select should show "all"
    const stateSelect = screen.getByDisplayValue('All states')
    expect(stateSelect).toBeTruthy()
  })

  it('defaults hideEmpty to true on fresh load', () => {
    render(<Pipeline />)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).toBeChecked()
  })

  it('migrates old localStorage (no version) to fresh defaults', () => {
    // Simulate old persisted state with active-only default
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      preset: 'active',
      filters: { owners: [], route: '', stateGroup: 'active' },
    }))

    render(<Pipeline />)

    // Should have reset to "All" preset, not kept old "Active"
    const allBtn = screen.getByRole('button', { name: 'All' })
    expect(allBtn.className).toContain('bg-amber')

    // Old localStorage should have been cleared
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(stored.version).toBe(2)
    expect(stored.preset).toBe('all')
  })

  it('migrates old localStorage (version 1) to fresh defaults', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      preset: 'active',
      filters: { owners: [], route: '', stateGroup: 'active' },
    }))

    render(<Pipeline />)
    const allBtn = screen.getByRole('button', { name: 'All' })
    expect(allBtn.className).toContain('bg-amber')
  })

  it('preserves valid version 2 localStorage state', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      preset: 'blocked',
      filters: { owners: [], route: '', stateGroup: 'error' },
      hideEmpty: false,
    }))

    render(<Pipeline />)
    const blockedBtn = screen.getByRole('button', { name: 'Blocked' })
    expect(blockedBtn.className).toContain('bg-amber')

    // hideEmpty should be false as saved
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox).not.toBeChecked()
  })
})

// ─── DONE column sort tests ─────────────────────────────────────────────────

describe('DONE column sorting — newest-first', () => {
  beforeEach(() => {
    localStorage.clear()
    mockTasks.length = 0
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('sorts DONE tasks by state_entered_at descending (newest first)', () => {
    const oldDone = makeTask({
      id: 'tsk_old',
      state: 'DONE',
      title: 'Old done',
      terminal: true,
      state_entered_at: '2026-01-01T00:00:00Z',
    })
    const newDone = makeTask({
      id: 'tsk_new',
      state: 'DONE',
      title: 'New done',
      terminal: true,
      state_entered_at: '2026-03-15T00:00:00Z',
    })
    const midDone = makeTask({
      id: 'tsk_mid',
      state: 'DONE',
      title: 'Mid done',
      terminal: true,
      state_entered_at: '2026-02-01T00:00:00Z',
    })

    mockTasks.push(oldDone, newDone, midDone)
    render(<Pipeline />)

    // All three DONE cards should render; check order
    const cards = screen.getAllByText(/done/i).filter(el =>
      el.textContent === 'New done' || el.textContent === 'Mid done' || el.textContent === 'Old done'
    )
    // The cards should appear in newest-first order
    expect(cards.map(c => c.textContent)).toEqual(['New done', 'Mid done', 'Old done'])
  })

  it('falls back to age when state_entered_at is missing', () => {
    const recentDone = makeTask({
      id: 'tsk_recent',
      state: 'DONE',
      title: 'Recent by age',
      terminal: true,
      age: 5,
    })
    const olderDone = makeTask({
      id: 'tsk_older',
      state: 'DONE',
      title: 'Older by age',
      terminal: true,
      age: 100,
    })

    mockTasks.push(olderDone, recentDone)
    render(<Pipeline />)

    const cards = screen.getAllByText(/by age/i)
    expect(cards.map(c => c.textContent)).toEqual(['Recent by age', 'Older by age'])
  })

  it('uses deterministic id fallback when both timestamp and age are missing', () => {
    const taskA = makeTask({
      id: 'tsk_aaa',
      state: 'DONE',
      title: 'Task A',
      terminal: true,
      age: null,
    })
    const taskZ = makeTask({
      id: 'tsk_zzz',
      state: 'DONE',
      title: 'Task Z',
      terminal: true,
      age: null,
    })

    mockTasks.push(taskA, taskZ)
    render(<Pipeline />)

    // id descending: tsk_zzz before tsk_aaa
    const cards = screen.getAllByText(/Task [AZ]/)
    expect(cards.map(c => c.textContent)).toEqual(['Task Z', 'Task A'])
  })
})
