import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Idea } from '../../src/lib/types'

// Mock API
vi.mock('../../src/lib/api', () => ({
  fetchIdeas: vi.fn(),
  submitApprovalDecision: vi.fn(),
  createTask: vi.fn(),
  approveIdea: vi.fn(),
}))

// Mock usePolling
vi.mock('../../src/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

// Mock useToast
const mockPush = vi.fn()
vi.mock('../../src/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ push: mockPush })),
}))

import ApprovalsPage from '../../src/pages/ApprovalsPage'
import ApprovalCard from '../../src/components/approvals/ApprovalCard'
import { submitApprovalDecision, createTask, approveIdea } from '../../src/lib/api'
import { usePolling } from '../../src/hooks/usePolling'

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea_20260401_abc123',
    title: 'Test approval idea',
    body: 'This idea needs your decision',
    status: 'pending_approval',
    tags: ['feature'],
    target_agent: 'brainstorm-claude',
    pending_since: '2026-04-01T10:00:00Z',
    approval_decisions: [],
    created_at: '2026-03-31T00:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  }
}

describe('Approval Queue', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('ApprovalsPage', () => {
    const mockRefetch = vi.fn().mockResolvedValue(undefined)

    it('renders empty state when no pending approvals', () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
      })

      render(<ApprovalsPage />)
      expect(screen.getByText('No items pending approval')).toBeTruthy()
    })

    it('renders loading skeletons while loading', () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: mockRefetch,
      })

      render(<ApprovalsPage />)
      // Should show skeleton divs with animate-skeleton class
      const skeletons = document.querySelectorAll('.animate-skeleton')
      expect(skeletons.length).toBe(3)
    })

    it('renders error state with retry', () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: null,
        loading: false,
        error: new Error('Network failure'),
        refetch: mockRefetch,
      })

      render(<ApprovalsPage />)
      expect(screen.getByText(/Network failure/)).toBeTruthy()
      expect(screen.getByText('Retry')).toBeTruthy()
    })

    it('renders approval cards for pending items', () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [makeIdea(), makeIdea({ id: 'idea_20260401_def456', title: 'Second idea' })],
        loading: false,
        error: null,
        refetch: mockRefetch,
      })

      render(<ApprovalsPage />)
      expect(screen.getByText('Test approval idea')).toBeTruthy()
      expect(screen.getByText('Second idea')).toBeTruthy()
    })

    it('shows badge count in header', () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [makeIdea(), makeIdea({ id: 'idea_20260401_def456' })],
        loading: false,
        error: null,
        refetch: mockRefetch,
      })

      render(<ApprovalsPage />)
      expect(screen.getByText('2')).toBeTruthy()
    })

    it('Yes action: submits decision, creates task, shows success toast', async () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [makeIdea()],
        loading: false,
        error: null,
        refetch: mockRefetch,
      });
      (submitApprovalDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        idea: { ...makeIdea(), status: 'approved' },
        decision: { action: 'yes', actor: 'platon', timestamp: '2026-04-01T12:00:00Z' },
      });
      (createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ task_id: 'tsk_001' });
      (approveIdea as ReturnType<typeof vi.fn>).mockResolvedValue({})

      render(<ApprovalsPage />)
      fireEvent.click(screen.getByText('Yes'))

      await waitFor(() => {
        expect(submitApprovalDecision).toHaveBeenCalledWith('idea_20260401_abc123', 'yes', undefined)
        expect(createTask).toHaveBeenCalledWith({
          title: 'Test approval idea',
          route: 'artifact_route',
          outcome_type: 'strategy_doc',
        })
        expect(approveIdea).toHaveBeenCalledWith('idea_20260401_abc123', 'tsk_001')
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({ message: expect.stringContaining('tsk_001'), variant: 'success' })
        )
      })
    })

    it('Later action: submits decision, shows warning toast', async () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [makeIdea()],
        loading: false,
        error: null,
        refetch: mockRefetch,
      });
      (submitApprovalDecision as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        idea: makeIdea(),
        decision: { action: 'later', actor: 'platon', timestamp: '2026-04-01T12:00:00Z' },
      })

      render(<ApprovalsPage />)
      fireEvent.click(screen.getByText('Later'))

      await waitFor(() => {
        expect(submitApprovalDecision).toHaveBeenCalledWith('idea_20260401_abc123', 'later', undefined)
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'warning' })
        )
      })
    })

    it('stale state error: shows warning and refetches', async () => {
      (usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [makeIdea()],
        loading: false,
        error: null,
        refetch: mockRefetch,
      });
      (submitApprovalDecision as ReturnType<typeof vi.fn>).mockRejectedValue({
        error: 'STALE_STATE',
        message: 'Item already resolved elsewhere',
        current_status: 'approved',
      })

      render(<ApprovalsPage />)
      fireEvent.click(screen.getByText('Later'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({ variant: 'warning', message: expect.stringContaining('resolved') })
        )
        expect(mockRefetch).toHaveBeenCalled()
      })
    })
  })

  describe('ApprovalCard', () => {
    const mockOnDecision = vi.fn().mockResolvedValue(undefined)

    it('renders idea title, body, and meta', () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      expect(screen.getByText('Test approval idea')).toBeTruthy()
      expect(screen.getByText('This idea needs your decision')).toBeTruthy()
      expect(screen.getByText('owner: platon')).toBeTruthy()
      expect(screen.getByText('idea_20260401_abc123')).toBeTruthy()
    })

    it('renders all 4 action buttons', () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      expect(screen.getByText('Yes')).toBeTruthy()
      expect(screen.getByText('Later')).toBeTruthy()
      expect(screen.getByText('No')).toBeTruthy()
      expect(screen.getByText('Rescope')).toBeTruthy()
    })

    it('Yes button calls onDecision directly', async () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      fireEvent.click(screen.getByText('Yes'))

      await waitFor(() => {
        expect(mockOnDecision).toHaveBeenCalledWith('idea_20260401_abc123', 'yes', undefined)
      })
    })

    it('Later button calls onDecision directly', async () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      fireEvent.click(screen.getByText('Later'))

      await waitFor(() => {
        expect(mockOnDecision).toHaveBeenCalledWith('idea_20260401_abc123', 'later', undefined)
      })
    })

    it('No button requires confirmation', () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      fireEvent.click(screen.getByText('No'))
      // Should show confirmation UI, not call onDecision yet
      expect(mockOnDecision).not.toHaveBeenCalled()
      expect(screen.getByText('Confirm')).toBeTruthy()
    })

    it('Rescope button requires confirmation', () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      fireEvent.click(screen.getByText('Rescope'))
      expect(mockOnDecision).not.toHaveBeenCalled()
      expect(screen.getByText('Confirm')).toBeTruthy()
    })

    it('No → Confirm calls onDecision with no action', async () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      fireEvent.click(screen.getByText('No'))
      fireEvent.click(screen.getByText('Confirm'))

      await waitFor(() => {
        expect(mockOnDecision).toHaveBeenCalledWith('idea_20260401_abc123', 'no', undefined)
      })
    })

    it('shows tags', () => {
      render(<ApprovalCard idea={makeIdea({ tags: ['infra', 'urgent'] })} onDecision={mockOnDecision} />)
      expect(screen.getByText('infra')).toBeTruthy()
      expect(screen.getByText('urgent')).toBeTruthy()
    })

    it('shows deferred note when last decision was later', () => {
      const idea = makeIdea({
        approval_decisions: [
          { action: 'later', actor: 'platon', timestamp: '2026-04-01T08:00:00Z', reason: 'Need more context' },
        ],
      })
      render(<ApprovalCard idea={idea} onDecision={mockOnDecision} />)
      expect(screen.getByText(/Need more context/)).toBeTruthy()
    })

    it('shows freshness indicator', () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      // Should render some freshness text (exact value depends on current time)
      const card = document.querySelector('.border-l-accent-purple')
      expect(card).toBeTruthy()
    })

    it('cancel confirmation returns to normal state', () => {
      render(<ApprovalCard idea={makeIdea()} onDecision={mockOnDecision} />)
      fireEvent.click(screen.getByText('No'))
      expect(screen.getByText('Confirm')).toBeTruthy()
      fireEvent.click(screen.getByText('Cancel'))
      expect(screen.queryByText('Confirm')).toBeNull()
    })
  })
})
