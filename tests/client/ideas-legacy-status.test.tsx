import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import IdeaCard from '../../src/components/ideas/IdeaCard'
import type { Idea, IdeaStatus } from '../../src/lib/types'

/**
 * Regression coverage for #148 — legacy ideas with status="reviewed"
 * or null/missing status must not crash the UI path.
 */

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea_20260330_abc123',
    title: 'Legacy idea',
    body: 'Some description',
    status: 'draft',
    tags: ['tag1'],
    target_agent: 'brainstorm-claude',
    created_at: '2026-03-30T00:00:00Z',
    updated_at: '2026-03-30T00:00:00Z',
    ...overrides,
  }
}

function defaultProps() {
  return {
    onStatusChange: vi.fn(),
    onApprove: vi.fn(() => Promise.resolve()),
    onArchive: vi.fn(),
  }
}

describe('IdeaCard — legacy / unknown status resilience', () => {
  afterEach(() => cleanup())

  it('renders without crash when status is "reviewed" (legacy enum)', () => {
    const idea = makeIdea({ status: 'reviewed' as IdeaStatus })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    // Should render title and id without throwing
    expect(screen.getByText('Legacy idea')).toBeTruthy()
    expect(screen.getByText('idea_20260330_abc123')).toBeTruthy()
    // Falls back to draft behavior — shows Archive button
    expect(screen.getByText('Archive')).toBeTruthy()
  })

  it('renders without crash when status is null', () => {
    const idea = makeIdea({ status: null as unknown as IdeaStatus })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    expect(screen.getByText('Legacy idea')).toBeTruthy()
  })

  it('renders without crash when status is undefined', () => {
    const idea = makeIdea({ status: undefined as unknown as IdeaStatus })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    expect(screen.getByText('Legacy idea')).toBeTruthy()
  })

  it('renders without crash when status is empty string', () => {
    const idea = makeIdea({ status: '' as IdeaStatus })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    expect(screen.getByText('Legacy idea')).toBeTruthy()
  })

  it('renders without crash when tags is undefined (legacy data)', () => {
    const idea = makeIdea({ tags: undefined as unknown as string[] })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    expect(screen.getByText('Legacy idea')).toBeTruthy()
  })

  it('renders without crash when tags is null (legacy data)', () => {
    const idea = makeIdea({ tags: null as unknown as string[] })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    expect(screen.getByText('Legacy idea')).toBeTruthy()
  })

  it('falls back to draft display for any unrecognized status string', () => {
    const idea = makeIdea({ status: 'some_future_status' as IdeaStatus })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    // Should show Draft label (fallback)
    expect(screen.getByText('Draft')).toBeTruthy()
    // Should show Start Brainstorm (draft action)
    expect(screen.getByText('Start Brainstorm')).toBeTruthy()
  })

  it('normalizes prototype-property status "toString" to draft', () => {
    const idea = makeIdea({ status: 'toString' as IdeaStatus })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Start Brainstorm')).toBeTruthy()
  })

  it('normalizes prototype-property status "__proto__" to draft', () => {
    const idea = makeIdea({ status: '__proto__' as IdeaStatus })
    render(<IdeaCard idea={idea} {...defaultProps()} />)
    expect(screen.getByText('Draft')).toBeTruthy()
    expect(screen.getByText('Start Brainstorm')).toBeTruthy()
  })
})
