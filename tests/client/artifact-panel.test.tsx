import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import ArtifactPanel from '../../src/components/ideas/ArtifactPanel'
import ConfirmDialog from '../../src/components/ui/ConfirmDialog'

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  updateIdea: vi.fn().mockResolvedValue({ id: 'idea_1', artifact_md: 'updated' }),
  approveIdea: vi.fn().mockResolvedValue({ ok: true, task_id: 'tsk_abc123' }),
}))

const SAMPLE_MD = `# Design Doc

## Overview
This is a brainstorm artifact.

- Item one
- Item two
- Item three

## Details
More content here.`

describe('ConfirmDialog', () => {
  afterEach(() => cleanup())

  it('renders title, message, and buttons', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Test Title"
        message="Are you sure?"
        confirmText="Yes"
        onConfirm={onConfirm}
        onCancel={onCancel}
        variant="warning"
      />
    )
    expect(screen.getByText('Test Title')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onCancel when overlay is clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="T"
        message="M"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByTestId('confirm-dialog-backdrop'))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onConfirm when confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="T"
        message="M"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(screen.getByTestId('confirm-button'))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('renders danger variant with red styling', () => {
    render(
      <ConfirmDialog
        title="Delete"
        message="This is permanent"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        variant="danger"
      />
    )
    const btn = screen.getByTestId('confirm-button')
    expect(btn.className).toContain('bg-red')
  })
})

describe('ArtifactPanel', () => {
  const onApprove = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => cleanup())

  it('renders collapsed by default with 3-line preview', () => {
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    expect(screen.getByText('▼ Show artifact')).toBeInTheDocument()
    // Should not show the full "Details" section when collapsed
    expect(screen.queryByText('▲ Hide artifact')).not.toBeInTheDocument()
  })

  it('expands when show button is clicked', () => {
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    fireEvent.click(screen.getByText('▼ Show artifact'))
    expect(screen.getByText('▲ Hide artifact')).toBeInTheDocument()
    // Markdown should be rendered — look for heading text
    expect(screen.getByText('Design Doc')).toBeInTheDocument()
  })

  it('collapses when hide button is clicked', () => {
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    fireEvent.click(screen.getByText('▼ Show artifact'))
    fireEvent.click(screen.getByText('▲ Hide artifact'))
    expect(screen.getByText('▼ Show artifact')).toBeInTheDocument()
  })

  it('shows approve confirmation dialog', () => {
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    fireEvent.click(screen.getByText('▼ Show artifact'))
    fireEvent.click(screen.getByTestId('approve-button'))
    expect(screen.getByText('Approve Idea')).toBeInTheDocument()
    expect(screen.getByText(/notify Платон/)).toBeInTheDocument()
  })

  it('calls approveIdea and onApprove on confirm', async () => {
    const { approveIdea } = await import('../../src/lib/api')
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    fireEvent.click(screen.getByText('▼ Show artifact'))
    fireEvent.click(screen.getByTestId('approve-button'))
    fireEvent.click(screen.getByTestId('confirm-button'))

    await waitFor(() => {
      expect(approveIdea).toHaveBeenCalledWith('idea_1')
      expect(onApprove).toHaveBeenCalledWith('tsk_abc123')
    })
  })

  it('enters edit mode and shows textarea', () => {
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    fireEvent.click(screen.getByText('▼ Show artifact'))
    fireEvent.click(screen.getByText('✏ Edit'))
    expect(screen.getByTestId('artifact-textarea')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Discard')).toBeInTheDocument()
  })

  it('saves edited artifact', async () => {
    const { updateIdea } = await import('../../src/lib/api')
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    fireEvent.click(screen.getByText('▼ Show artifact'))
    fireEvent.click(screen.getByText('✏ Edit'))

    const textarea = screen.getByTestId('artifact-textarea')
    fireEvent.change(textarea, { target: { value: 'Updated content' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(updateIdea).toHaveBeenCalledWith('idea_1', { artifact_md: 'Updated content' })
    })
  })

  it('discards edits on discard click', () => {
    render(<ArtifactPanel artifact={SAMPLE_MD} ideaId="idea_1" onApprove={onApprove} />)
    fireEvent.click(screen.getByText('▼ Show artifact'))
    fireEvent.click(screen.getByText('✏ Edit'))

    const textarea = screen.getByTestId('artifact-textarea')
    fireEvent.change(textarea, { target: { value: 'Changed' } })
    fireEvent.click(screen.getByText('Discard'))

    // Should exit edit mode
    expect(screen.queryByTestId('artifact-textarea')).not.toBeInTheDocument()
  })
})
