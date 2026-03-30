import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Mock useToast
vi.mock('../../src/hooks/useToast', () => ({
  useToast: () => ({ toasts: [], push: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

// Mock api
const mockAddTaskEvent = vi.fn()
const mockFetchTaskEvents = vi.fn()
vi.mock('../../src/lib/api', () => ({
  addTaskEvent: (...args: unknown[]) => mockAddTaskEvent(...args),
  fetchTaskEvents: (...args: unknown[]) => mockFetchTaskEvents(...args),
  fetchTaskDecisions: vi.fn().mockResolvedValue([]),
  fetchTaskContract: vi.fn().mockResolvedValue(null),
  transitionTask: vi.fn(),
}))

import { TaskDetail } from '../../src/components/pipeline/TaskDetail'
import type { Task } from '../../src/lib/types'

const baseTask: Task = {
  id: 'tsk_001',
  state: 'EXECUTION',
  owner: 'archimedes',
  route: 'build_route',
  title: 'Test Task',
  age: 5,
  ttl: null,
  blockers: 0,
  retries: 0,
  terminal: false,
  hasQuality: false,
  hasOutcome: false,
  hasRelease: false,
  actors: [],
}

async function renderLoaded(taskOverrides?: Partial<Task>) {
  const task = { ...baseTask, ...taskOverrides }
  render(<TaskDetail task={task} onClose={vi.fn()} onTransition={vi.fn()} />)
  // Wait for loading to finish (data fetches resolve)
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
}

describe('TaskDetail Add Event', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    mockAddTaskEvent.mockResolvedValue({ ok: true })
    mockFetchTaskEvents.mockResolvedValue([])
  })

  it('shows Add Event button but no textarea initially', async () => {
    await renderLoaded()
    expect(screen.getByRole('button', { name: /add event/i })).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/describe the event/i)).not.toBeInTheDocument()
  })

  it('expands textarea on Add Event click', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    expect(screen.getByPlaceholderText(/describe the event/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
    // Button text changes to Cancel
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('collapses textarea on Cancel click', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))
    expect(screen.getByPlaceholderText(/describe the event/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByPlaceholderText(/describe the event/i)).not.toBeInTheDocument()
  })

  it('Add button is disabled when textarea is empty', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })

  it('Add button is disabled for whitespace-only input', async () => {
    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    fireEvent.change(screen.getByPlaceholderText(/describe the event/i), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })

  it('submits event, hides textarea, and refreshes timeline', async () => {
    const noteEvent = {
      event_type: 'NOTE',
      actor: 'operator',
      timestamp: new Date().toISOString(),
      payload: { body: 'Deploy completed' },
    }
    mockFetchTaskEvents.mockResolvedValueOnce([]).mockResolvedValueOnce([noteEvent])

    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    const textarea = screen.getByPlaceholderText(/describe the event/i)
    fireEvent.change(textarea, { target: { value: 'Deploy completed' } })
    expect(screen.getByRole('button', { name: /^add$/i })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect(mockAddTaskEvent).toHaveBeenCalledWith('tsk_001', 'NOTE', {
        actor: 'operator',
        body: 'Deploy completed',
      })
    })

    await waitFor(() => {
      // Textarea should be hidden after successful submit
      expect(screen.queryByPlaceholderText(/describe the event/i)).not.toBeInTheDocument()
    })
  })

  it('shows error and keeps textarea open on failure', async () => {
    mockAddTaskEvent.mockRejectedValue(new Error('Network error'))

    await renderLoaded()
    fireEvent.click(screen.getByRole('button', { name: /add event/i }))

    fireEvent.change(screen.getByPlaceholderText(/describe the event/i), {
      target: { value: 'Will fail' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    // Textarea should still be visible
    expect(screen.getByPlaceholderText(/describe the event/i)).toBeInTheDocument()
  })
})
