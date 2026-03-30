import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

// Mock api — TaskDetail fetches events, decisions, contract on mount
vi.mock('../../src/lib/api', () => ({
  fetchTaskEvents: vi.fn().mockResolvedValue([]),
  fetchTaskDecisions: vi.fn().mockResolvedValue([]),
  fetchTaskContract: vi.fn().mockResolvedValue(null),
  transitionTask: vi.fn(),
  addTaskEvent: vi.fn(),
}))

import { TaskDetail } from '../../src/components/pipeline/TaskDetail'
import type { Task } from '../../src/lib/types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test_001',
    state: 'BACKLOG',
    owner: 'archimedes',
    route: 'codex',
    title: 'Test Task',
    age: 0,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    ...overrides,
  }
}

describe('TaskDetail — Artifacts section', () => {
  afterEach(cleanup)

  it('does not render Artifacts section when task has no artifacts', async () => {
    render(<TaskDetail task={makeTask()} onClose={vi.fn()} onTransition={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    expect(screen.queryByTestId('artifacts-section')).not.toBeInTheDocument()
    expect(screen.queryByText('Artifacts')).not.toBeInTheDocument()
  })

  it('does not render Artifacts section when artifacts is empty array', async () => {
    render(<TaskDetail task={makeTask({ artifacts: [] })} onClose={vi.fn()} onTransition={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    expect(screen.queryByTestId('artifacts-section')).not.toBeInTheDocument()
  })

  it('renders Artifacts section when task has artifacts', async () => {
    const artifacts = ['output/report.md', 'output/summary.json']
    render(
      <TaskDetail task={makeTask({ artifacts })} onClose={vi.fn()} onTransition={vi.fn()} />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    expect(screen.getByTestId('artifacts-section')).toBeInTheDocument()
    expect(screen.getByText('output/report.md')).toBeInTheDocument()
    expect(screen.getByText('output/summary.json')).toBeInTheDocument()
  })
})
