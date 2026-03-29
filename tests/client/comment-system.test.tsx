import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Mock useToast
const mockPush = vi.fn()
vi.mock('../../src/hooks/useToast', () => ({
  useToast: () => ({ toasts: [], push: mockPush, dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

// Mock api
vi.mock('../../src/lib/api', () => ({
  addTaskEvent: vi.fn(),
}))

import { CommentThread } from '../../src/components/pipeline/CommentThread'
import { CommentInput } from '../../src/components/pipeline/CommentInput'
import { addTaskEvent } from '../../src/lib/api'

describe('CommentThread', () => {
  afterEach(cleanup)

  it('renders empty state when no comments', () => {
    render(<CommentThread comments={[]} />)
    expect(screen.getByText('No comments yet')).toBeInTheDocument()
  })

  it('renders comments in order with author and time', () => {
    const comments = [
      { actor: 'owner', body: 'First comment', timestamp: new Date(Date.now() - 120000).toISOString() },
      { actor: 'archimedes', body: 'Second comment', timestamp: new Date(Date.now() - 60000).toISOString() },
    ]
    render(<CommentThread comments={comments} />)

    expect(screen.getByText('First comment')).toBeInTheDocument()
    expect(screen.getByText('Second comment')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText('archimedes')).toBeInTheDocument()
  })

  it('shows correct agent emojis', () => {
    const comments = [
      { actor: 'owner', body: 'Hello', timestamp: new Date().toISOString() },
      { actor: 'archimedes', body: 'Hi', timestamp: new Date().toISOString() },
    ]
    render(<CommentThread comments={comments} />)
    const thread = screen.getByTestId('comment-thread')
    expect(thread.textContent).toContain('💬')
    expect(thread.textContent).toContain('⚙️')
  })

  it('shows relative timestamps', () => {
    const comments = [
      { actor: 'owner', body: 'Just now', timestamp: new Date().toISOString() },
      { actor: 'owner', body: 'Minutes ago', timestamp: new Date(Date.now() - 300000).toISOString() },
    ]
    render(<CommentThread comments={comments} />)
    expect(screen.getByText('just now')).toBeInTheDocument()
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('shows unknown emoji for unrecognized actors', () => {
    const comments = [
      { actor: 'mystery', body: 'Test', timestamp: new Date().toISOString() },
    ]
    render(<CommentThread comments={comments} />)
    const thread = screen.getByTestId('comment-thread')
    expect(thread.textContent).toContain('👤')
  })
})

describe('CommentInput', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(addTaskEvent).mockResolvedValue({ ok: true })
  })

  it('renders textarea and send button', () => {
    render(<CommentInput taskId="tsk_001" onCommentAdded={vi.fn()} />)
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('send button is disabled when textarea is empty', () => {
    render(<CommentInput taskId="tsk_001" onCommentAdded={vi.fn()} />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('sends USER_COMMENT event on click and clears textarea', async () => {
    const onAdded = vi.fn()
    render(<CommentInput taskId="tsk_001" onCommentAdded={onAdded} />)

    const textarea = screen.getByPlaceholderText(/add a comment/i)
    fireEvent.change(textarea, { target: { value: 'Test comment' } })
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(addTaskEvent).toHaveBeenCalledWith('tsk_001', 'USER_COMMENT', {
        actor: 'owner',
        body: 'Test comment',
      })
    })

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalled()
      expect(textarea).toHaveValue('')
    })
  })

  it('sends on Ctrl+Enter', async () => {
    const onAdded = vi.fn()
    render(<CommentInput taskId="tsk_001" onCommentAdded={onAdded} />)

    const textarea = screen.getByPlaceholderText(/add a comment/i)
    fireEvent.change(textarea, { target: { value: 'Ctrl enter test' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(addTaskEvent).toHaveBeenCalledWith('tsk_001', 'USER_COMMENT', {
        actor: 'owner',
        body: 'Ctrl enter test',
      })
    })
  })

  it('shows toast on error', async () => {
    vi.mocked(addTaskEvent).mockRejectedValue(new Error('Network error'))
    render(<CommentInput taskId="tsk_001" onCommentAdded={vi.fn()} />)

    const textarea = screen.getByPlaceholderText(/add a comment/i)
    fireEvent.change(textarea, { target: { value: 'Will fail' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('Network error', 'error')
    })
  })

  it('does not send whitespace-only messages', async () => {
    render(<CommentInput taskId="tsk_001" onCommentAdded={vi.fn()} />)

    const textarea = screen.getByPlaceholderText(/add a comment/i)
    fireEvent.change(textarea, { target: { value: '   ' } })
    // Button should be disabled for whitespace
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })
})
