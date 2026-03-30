import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Task } from '../../src/lib/types'

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
  CSS: { Transform: { toString: vi.fn(() => '') } },
}))

import { TaskCard } from '../../src/components/pipeline/TaskCard'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test',
    state: 'AWAITING_OWNER',
    owner: 'archimedes',
    route: 'build_route',
    title: 'Test task',
    age: 30,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    actors: ['archimedes'],
    ...overrides,
  }
}

describe('TaskCard — lastAgentMessage preview', () => {
  afterEach(cleanup)

  it('renders agent message preview for AWAITING_OWNER with lastAgentMessage', () => {
    const task = makeTask({ lastAgentMessage: 'I need clarification on the API schema' })
    render(<TaskCard task={task} onClick={vi.fn()} />)

    expect(screen.getByText('I need clarification on the API schema')).toBeInTheDocument()
  })

  it('does not render preview when lastAgentMessage is null', () => {
    const task = makeTask({ lastAgentMessage: null })
    render(<TaskCard task={task} onClick={vi.fn()} />)

    // "Awaiting your input" should be present but no preview paragraph
    expect(screen.getByText(/Awaiting your input/)).toBeInTheDocument()
    expect(screen.queryByText('I need clarification')).not.toBeInTheDocument()
  })

  it('does not render preview for non-AWAITING_OWNER state even with lastAgentMessage', () => {
    const task = makeTask({ state: 'EXECUTION', lastAgentMessage: 'Some message' })
    render(<TaskCard task={task} onClick={vi.fn()} />)

    expect(screen.queryByText('Some message')).not.toBeInTheDocument()
  })

  it('renders preview with border-l-2 and border-amber styling', () => {
    const msg = 'Please review the failing test output'
    const task = makeTask({ lastAgentMessage: msg })
    render(<TaskCard task={task} onClick={vi.fn()} />)

    const preview = screen.getByText(msg)
    expect(preview.tagName).toBe('P')
    expect(preview.className).toContain('border-l-2')
    expect(preview.className).toContain('border-amber')
    expect(preview.className).toContain('line-clamp-2')
  })
})
