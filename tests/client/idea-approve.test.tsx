import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Idea } from '../../src/lib/types'

// Mock API
vi.mock('../../src/lib/api', () => ({
  fetchIdeas: vi.fn(),
  createIdea: vi.fn(),
  updateIdea: vi.fn(),
  deleteIdea: vi.fn(),
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

import IdeasPage from '../../src/pages/IdeasPage'
import IdeaCard from '../../src/components/ideas/IdeaCard'
import { createTask, approveIdea } from '../../src/lib/api'
import { usePolling } from '../../src/hooks/usePolling'

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: 'idea_001',
    title: 'Test idea',
    body: 'Some body',
    status: 'artifact_ready',
    tags: [],
    target_agent: 'brainstorm-claude',
    created_at: '2026-03-31T00:00:00Z',
    updated_at: '2026-03-31T00:00:00Z',
    ...overrides,
  }
}

describe('Ideas approve & create task', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('IdeasPage integration', () => {
    const mockRefetch = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      ;(usePolling as ReturnType<typeof vi.fn>).mockReturnValue({
        data: [makeIdea()],
        loading: false,
        refetch: mockRefetch,
      })
    })

    it('approve success: createTask called, then approveIdea with task_id, then success toast', async () => {
      ;(createTask as ReturnType<typeof vi.fn>).mockResolvedValue({ task_id: 'tsk_abc' })
      ;(approveIdea as ReturnType<typeof vi.fn>).mockResolvedValue({})

      render(<IdeasPage />)

      fireEvent.click(screen.getByText('Approve & Create Task'))

      await waitFor(() => {
        expect(createTask).toHaveBeenCalledWith({
          title: 'Test idea',
          route: 'artifact_route',
          outcome_type: 'strategy_doc',
        })
        expect(approveIdea).toHaveBeenCalledWith('idea_001', 'tsk_abc')
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Task created: tsk_abc', variant: 'success' })
        )
      })
    })

    it('createTask fails: approveIdea NOT called, error toast shown', async () => {
      ;(createTask as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'))

      render(<IdeasPage />)

      fireEvent.click(screen.getByText('Approve & Create Task'))

      await waitFor(() => {
        expect(createTask).toHaveBeenCalled()
        expect(approveIdea).not.toHaveBeenCalled()
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Network error', variant: 'error' })
        )
      })
    })
  })

  describe('IdeaCard task_id badge', () => {
    it('shows task_id badge when task_id is set', () => {
      const idea = makeIdea({ status: 'approved', task_id: 'tsk_xyz' })
      render(
        <IdeaCard
          idea={idea}
          onStatusChange={vi.fn()}
          onApprove={vi.fn()}
          onArchive={vi.fn()}
        />
      )
      expect(screen.getByText('tsk_xyz')).toBeTruthy()
    })

    it('does not show task_id badge when task_id is null', () => {
      const idea = makeIdea({ status: 'approved', task_id: null })
      render(
        <IdeaCard
          idea={idea}
          onStatusChange={vi.fn()}
          onApprove={vi.fn()}
          onArchive={vi.fn()}
        />
      )
      expect(screen.queryByText('tsk_xyz')).toBeNull()
    })
  })
})
