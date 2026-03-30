import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Task, PipelineState } from '../../src/lib/types'

vi.mock('@dnd-kit/sortable', () => ({
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

import { TaskCard } from '../../src/components/pipeline/TaskCard'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_tooltip',
    state: 'EXECUTION' as PipelineState,
    owner: 'archimedes',
    route: 'build_route',
    title: 'Tooltip test task',
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

describe('TaskCard Q/O/R hover tooltips', () => {
  afterEach(() => cleanup())

  it('shows retries tooltip with plural form for retries=2', () => {
    render(<TaskCard task={makeTask({ retries: 2 })} onClick={vi.fn()} />)
    const el = screen.getByTitle('2 retries')
    expect(el).toBeTruthy()
    expect(el.className).toContain('cursor-help')
  })

  it('shows retries tooltip with singular form for retries=1', () => {
    render(<TaskCard task={makeTask({ retries: 1 })} onClick={vi.fn()} />)
    const el = screen.getByTitle('1 retry')
    expect(el).toBeTruthy()
    expect(el.className).toContain('cursor-help')
  })

  it('shows "Quality gate passed" tooltip on Q icon', () => {
    render(<TaskCard task={makeTask({ hasQuality: true })} onClick={vi.fn()} />)
    const el = screen.getByTitle('Quality gate passed')
    expect(el).toBeTruthy()
    expect(el.textContent).toBe('Q')
    expect(el.className).toContain('cursor-help')
  })

  it('shows "Outcome manifest" tooltip on O icon', () => {
    render(<TaskCard task={makeTask({ hasOutcome: true })} onClick={vi.fn()} />)
    const el = screen.getByTitle('Outcome manifest')
    expect(el).toBeTruthy()
    expect(el.textContent).toBe('O')
    expect(el.className).toContain('cursor-help')
  })

  it('all three tooltips render together', () => {
    render(
      <TaskCard
        task={makeTask({ retries: 2, hasQuality: true, hasOutcome: true })}
        onClick={vi.fn()}
      />
    )
    expect(screen.getByTitle('2 retries')).toBeTruthy()
    expect(screen.getByTitle('Quality gate passed')).toBeTruthy()
    expect(screen.getByTitle('Outcome manifest')).toBeTruthy()
  })
})
