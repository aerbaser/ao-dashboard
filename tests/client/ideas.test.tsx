import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import IdeaCard from '../../src/components/ideas/IdeaCard'
import IdeaForm from '../../src/components/ideas/IdeaForm'
import type { Idea, IdeaStatus } from '../../src/lib/types'

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea_20260330_abc123',
    title: 'Test idea',
    body: 'Some description text',
    status: 'draft',
    tags: ['tag1', 'tag2'],
    target_agent: 'brainstorm-claude',
    created_at: '2026-03-30T00:00:00Z',
    updated_at: '2026-03-30T00:00:00Z',
    ...overrides,
  }
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    onStatusChange: vi.fn(),
    onApprove: vi.fn(() => Promise.resolve()),
    onArchive: vi.fn(),
    ...overrides,
  }
}

describe('IdeaCard', () => {
  afterEach(() => cleanup())

  const statuses: IdeaStatus[] = ['draft', 'brainstorming', 'artifact_ready', 'approved', 'in_work', 'archived']

  statuses.forEach((status) => {
    it(`renders ${status} status correctly`, () => {
      render(<IdeaCard idea={makeIdea({ status })} {...defaultProps()} />)
      expect(screen.getByText('Test idea')).toBeTruthy()
      expect(screen.getByText('idea_20260330_abc123')).toBeTruthy()
    })
  })

  it('shows status-specific action buttons', () => {
    render(<IdeaCard idea={makeIdea({ status: 'draft' })} {...defaultProps()} />)
    expect(screen.getByText('Start Brainstorm')).toBeTruthy()
    expect(screen.getByText('Archive')).toBeTruthy()
  })

  it('calls onStatusChange when action button clicked', () => {
    const props = defaultProps()
    render(<IdeaCard idea={makeIdea({ status: 'draft' })} {...props} />)
    fireEvent.click(screen.getByText('Start Brainstorm'))
    expect(props.onStatusChange).toHaveBeenCalledWith('idea_20260330_abc123', 'brainstorming')
  })

  it('calls onArchive when archive button clicked', () => {
    const props = defaultProps()
    render(<IdeaCard idea={makeIdea({ status: 'draft' })} {...props} />)
    fireEvent.click(screen.getByText('Archive'))
    expect(props.onArchive).toHaveBeenCalledWith('idea_20260330_abc123')
  })

  it('renders tags', () => {
    render(<IdeaCard idea={makeIdea()} {...defaultProps()} />)
    expect(screen.getByText('tag1')).toBeTruthy()
    expect(screen.getByText('tag2')).toBeTruthy()
  })

  it('shows Restore action for archived status', () => {
    render(<IdeaCard idea={makeIdea({ status: 'archived' })} {...defaultProps()} />)
    expect(screen.getByText('Restore')).toBeTruthy()
    // No archive button for already archived
    expect(screen.queryByText('Archive')).toBeNull()
  })

  it('shows task_id badge as link when present', () => {
    render(<IdeaCard idea={makeIdea({ status: 'approved', task_id: 'tsk_001' })} {...defaultProps()} />)
    const link = screen.getByText('tsk_001')
    expect(link).toBeTruthy()
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/pipeline?task=tsk_001')
  })

  it('shows "Approve & Create Task" button for artifact_ready status', () => {
    render(<IdeaCard idea={makeIdea({ status: 'artifact_ready' })} {...defaultProps()} />)
    expect(screen.getByText('Approve & Create Task')).toBeTruthy()
  })

  it('calls onApprove when Approve & Create Task clicked', async () => {
    const props = defaultProps()
    render(<IdeaCard idea={makeIdea({ status: 'artifact_ready' })} {...props} />)
    fireEvent.click(screen.getByText('Approve & Create Task'))
    expect(props.onApprove).toHaveBeenCalledWith('idea_20260330_abc123')
  })

  it('disables button and shows "Creating Task…" while approving', async () => {
    let resolve: () => void
    const slow = new Promise<void>((r) => { resolve = r })
    const onApprove = vi.fn(() => slow)
    render(<IdeaCard idea={makeIdea({ status: 'artifact_ready' })} {...defaultProps({ onApprove })} />)
    fireEvent.click(screen.getByText('Approve & Create Task'))
    await waitFor(() => expect(screen.getByText('Creating Task…')).toBeTruthy())
    expect(screen.getByText('Creating Task…').closest('button')).toHaveProperty('disabled', true)
    resolve!()
  })

  it('does not show Start Work button for approved status', () => {
    render(<IdeaCard idea={makeIdea({ status: 'approved' })} {...defaultProps()} />)
    expect(screen.queryByText('Start Work')).toBeNull()
  })
})

describe('IdeaForm', () => {
  afterEach(() => cleanup())
  it('renders all form fields', () => {
    render(<IdeaForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText('Idea title...')).toBeTruthy()
    expect(screen.getByPlaceholderText('Description (markdown)...')).toBeTruthy()
    expect(screen.getByPlaceholderText('Tags (comma-separated)')).toBeTruthy()
  })

  it('disables submit when title is empty', () => {
    render(<IdeaForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const submitBtn = screen.getByRole('button', { name: 'Create Idea' })
    expect(submitBtn).toHaveProperty('disabled', true)
  })

  it('enables submit when title has content', () => {
    render(<IdeaForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Idea title...'), { target: { value: 'My idea' } })
    const submitBtn = screen.getByRole('button', { name: 'Create Idea' })
    expect(submitBtn).toHaveProperty('disabled', false)
  })

  it('calls onSubmit with form data', () => {
    const onSubmit = vi.fn()
    render(<IdeaForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('Idea title...'), { target: { value: 'New idea' } })
    fireEvent.change(screen.getByPlaceholderText('Description (markdown)...'), { target: { value: 'Body text' } })
    fireEvent.change(screen.getByPlaceholderText('Tags (comma-separated)'), { target: { value: 'a, b, c' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Create Idea' }))
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'New idea',
      body: 'Body text',
      tags: ['a', 'b', 'c'],
      target_agent: 'brainstorm-claude',
    })
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn()
    render(<IdeaForm onSubmit={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('shows Creating... when submitting', () => {
    render(<IdeaForm onSubmit={vi.fn()} onCancel={vi.fn()} submitting />)
    expect(screen.getByRole('button', { name: 'Creating...' })).toBeTruthy()
  })
})
