import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import IdeaCard from '../../src/components/ideas/IdeaCard'
import IdeaForm from '../../src/components/ideas/IdeaForm'
import type { Idea, IdeaStatus } from '../../src/lib/types'

const {
  fetchApprovalQueueMock,
  submitIdeaApprovalDecisionMock,
  pushMock,
} = vi.hoisted(() => ({
  fetchApprovalQueueMock: vi.fn(),
  submitIdeaApprovalDecisionMock: vi.fn(),
  pushMock: vi.fn(),
}))

vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/api')>('../../src/lib/api')
  return {
    ...actual,
    fetchIdeas: vi.fn(),
    createIdea: vi.fn(),
    updateIdea: vi.fn(),
    deleteIdea: vi.fn(),
    createTask: vi.fn(),
    approveIdea: vi.fn(),
    fetchApprovalQueue: fetchApprovalQueueMock,
    submitIdeaApprovalDecision: submitIdeaApprovalDecisionMock,
  }
})

vi.mock('../../src/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

vi.mock('../../src/hooks/useToast', () => ({
  useToast: () => ({ push: pushMock }),
}))

import IdeasPage from '../../src/pages/IdeasPage'
import { usePolling } from '../../src/hooks/usePolling'

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

function makePollingResult<T>(overrides: Partial<{
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
  refresh: () => void
}> = {}) {
  const refetch = overrides.refetch ?? vi.fn()
  return {
    data: overrides.data ?? null,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    refetch,
    refresh: overrides.refresh ?? refetch,
  }
}

function makeApprovalItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'idea_20260401_queue01',
    title: 'Approval lane idea',
    why: 'Needs explicit product approval',
    route: 'artifact_route',
    expected_outcome: 'strategy_doc',
    owner: 'platon',
    pending_since: '2026-04-01T10:00:00Z',
    freshness_updated_at: '2026-04-01T10:05:00Z',
    next_action: 'Await operator decision',
    approval_state: 'pending',
    task_id: null,
    decision_note: null,
    error: null,
    idea_status: 'artifact_ready',
    ...overrides,
  }
}

function mockIdeasPagePolling(ideasResult: ReturnType<typeof makePollingResult>, queueResult: ReturnType<typeof makePollingResult>) {
  let call = 0
  vi.mocked(usePolling).mockImplementation(() => {
    call += 1
    return call % 2 === 1 ? ideasResult : queueResult
  })
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

describe('IdeasPage approval queue', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows a loading state while the approval queue is fetching', () => {
    mockIdeasPagePolling(
      makePollingResult<Idea[]>({ data: [], loading: false }),
      makePollingResult({ data: null, loading: true }),
    )

    render(<IdeasPage />)

    expect(screen.getByText('Approval Queue')).toBeTruthy()
    expect(screen.getByText('Loading approval queue…')).toBeTruthy()
  })

  it('shows an empty state when no approvals are waiting', () => {
    mockIdeasPagePolling(
      makePollingResult<Idea[]>({ data: [], loading: false }),
      makePollingResult({ data: [], loading: false }),
    )

    render(<IdeasPage />)

    expect(screen.getByText('No approvals waiting')).toBeTruthy()
  })

  it('shows an error state when the queue fails to load', () => {
    mockIdeasPagePolling(
      makePollingResult<Idea[]>({ data: [], loading: false }),
      makePollingResult({ data: null, loading: false, error: new Error('Queue unavailable') }),
    )

    render(<IdeasPage />)

    expect(screen.getByText('Approval queue unavailable')).toBeTruthy()
    expect(screen.getByText(/Queue unavailable/)).toBeTruthy()
  })

  it('renders approval cards with context and routed task links', () => {
    mockIdeasPagePolling(
      makePollingResult<Idea[]>({ data: [], loading: false }),
      makePollingResult({
        data: [
          makeApprovalItem(),
          makeApprovalItem({
            id: 'idea_20260401_queue02',
            title: 'Already routed',
            approval_state: 'routed',
            task_id: 'tsk_123',
            next_action: 'Track routed task tsk_123',
          }),
        ],
        loading: false,
      }),
    )

    render(<IdeasPage />)

    expect(screen.getByText('Approval lane idea')).toBeTruthy()
    expect(screen.getAllByText('Needs explicit product approval')).toHaveLength(2)
    expect(screen.getAllByText('artifact')).toHaveLength(2)
    expect(screen.getAllByText('strategy doc')).toHaveLength(2)
    expect(screen.getAllByText('platon')).toHaveLength(2)
    expect(screen.getByText('Await operator decision')).toBeTruthy()
    expect(screen.getByText('Already routed')).toBeTruthy()
    const taskLink = screen.getByText('tsk_123')
    expect(taskLink.tagName).toBe('A')
    expect(taskLink.getAttribute('href')).toBe('/pipeline?task=tsk_123')
  })

  it('submits approval decisions and disables the action while pending', async () => {
    let resolveDecision: (() => void) | null = null
    submitIdeaApprovalDecisionMock.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveDecision = resolve
    }))

    mockIdeasPagePolling(
      makePollingResult<Idea[]>({ data: [], loading: false }),
      makePollingResult({ data: [makeApprovalItem()], loading: false }),
    )

    render(<IdeasPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))

    expect(submitIdeaApprovalDecisionMock).toHaveBeenCalledWith('idea_20260401_queue01', 'yes')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submitting…' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Submitting…' })).toHaveProperty('disabled', true)

    resolveDecision?.()
  })

  it('refetches the queue after a stale decision error', async () => {
    const queueRefetch = vi.fn()
    submitIdeaApprovalDecisionMock.mockRejectedValueOnce(new Error('STALE_DECISION'))

    mockIdeasPagePolling(
      makePollingResult<Idea[]>({ data: [], loading: false }),
      makePollingResult({ data: [makeApprovalItem()], loading: false, refetch: queueRefetch }),
    )

    render(<IdeasPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))

    await waitFor(() => expect(queueRefetch).toHaveBeenCalled())
  })
})
