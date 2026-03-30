import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import type { Task, PipelineState } from '../../src/lib/types'
import { STATE_TRANSITIONS } from '../../src/lib/types'

// Mock api calls
vi.mock('../../src/lib/api', () => ({
  fetchTaskEvents: vi.fn(() => Promise.resolve([])),
  fetchTaskDecisions: vi.fn(() => Promise.resolve([])),
  fetchTaskContract: vi.fn(() => Promise.resolve(null)),
  transitionTask: vi.fn(),
  addTaskEvent: vi.fn(),
}))

import { TaskDetail } from '../../src/components/pipeline/TaskDetail'

function makeTask(state: PipelineState): Task {
  return {
    id: 'tsk_test_001',
    state,
    owner: 'archimedes',
    route: 'build_route',
    title: 'Test task',
    age: 100,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
  }
}

describe('TaskDetail transition selector', () => {
  afterEach(cleanup)

  const statesToTest: PipelineState[] = [
    'INTAKE', 'EXECUTION', 'REVIEW_PENDING', 'DONE', 'BLOCKED', 'FAILED',
  ]

  for (const state of statesToTest) {
    it(`shows only valid transitions for ${state}`, async () => {
      render(
        <TaskDetail
          task={makeTask(state)}
          onClose={vi.fn()}
          onTransition={vi.fn()}
        />
      )

      // Wait for loading to finish
      await screen.findByText('Actions', {}, { timeout: 2000 })

      const select = screen.getByRole('combobox')
      const options = Array.from(select.querySelectorAll('option'))
        .map(o => o.textContent)
        .filter(t => t !== 'Transition to...')

      const expected = STATE_TRANSITIONS[state] as readonly string[]
      expect(options).toEqual([...expected])
    })
  }

  it('DONE state shows no transition options', async () => {
    render(
      <TaskDetail
        task={makeTask('DONE')}
        onClose={vi.fn()}
        onTransition={vi.fn()}
      />
    )

    await screen.findByText('Actions', {}, { timeout: 2000 })

    const select = screen.getByRole('combobox')
    const options = Array.from(select.querySelectorAll('option'))
      .filter(o => o.textContent !== 'Transition to...')

    expect(options).toHaveLength(0)
  })
})
