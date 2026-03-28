import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AgentDetailPanel from '../../src/components/agents/AgentDetailPanel'
import type { AgentInfo } from '../../src/lib/api'

const mockAgent: AgentInfo = {
  id: 'archimedes',
  name: 'Archimedes',
  emoji: '🔧',
  role: 'Engineer',
  status: 'active',
  current_task_id: 'tsk_20260327_abc123',
  current_step: 'coding',
  progress_note: null,
  checkpoint_safe: true,
  last_seen: new Date(Date.now() - 120_000).toISOString(), // 2m ago
  session_key: null,
  workspace_path: '/home/test/.openclaw/workspace-archimedes',
  topic_id: null,
  model: 'opus-4-6',
  heartbeat_raw: null,
  mailbox: { inbox: 2, processing: 1, done: 5, deadletter: 0 },
}

// Mock the API module
vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual('../../src/lib/api')
  return {
    ...actual,
    fetchAgentFile: vi.fn().mockResolvedValue({ content: '# Test Agent\nSome content', filename: 'AGENTS.md', path: '/test' }),
    saveAgentFile: vi.fn().mockResolvedValue({ ok: true }),
  }
})

import { fetchAgentFile, saveAgentFile } from '../../src/lib/api'

describe('AgentDetailPanel', () => {
  const onClose = vi.fn()
  const onToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders header with agent info', () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    expect(screen.getByText(/Archimedes/)).toBeInTheDocument()
    expect(screen.getByText('(archimedes)')).toBeInTheDocument()
    expect(screen.getByText('Engineer')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('tsk_20260327_abc123')).toBeInTheDocument()
  })

  it('renders 3 tabs with correct labels', () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    expect(screen.getByRole('button', { name: 'Skills' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Files' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Model' })).toBeInTheDocument()
  })

  it('close button calls onClose', () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByLabelText('Close detail panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Skills tab shows placeholder by default', () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    expect(screen.getByText(/Skills management coming soon/)).toBeInTheDocument()
  })

  it('switches to Files tab and loads files', async () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(fetchAgentFile).toHaveBeenCalledWith('archimedes', 'AGENTS.md')
      expect(fetchAgentFile).toHaveBeenCalledWith('archimedes', 'SOUL.md')
      expect(fetchAgentFile).toHaveBeenCalledWith('archimedes', 'TOOLS.md')
    })
  })

  it('switches to Model tab and shows placeholder', () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByRole('button', { name: 'Model' }))
    expect(screen.getByText(/Model selector coming soon/)).toBeInTheDocument()
  })

  it('Files tab: shows unsaved indicator after editing', async () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Edit AGENTS.md...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Edit AGENTS.md...')
    fireEvent.change(textarea, { target: { value: 'modified content' } })

    // Amber dot should appear on the AGENTS.md sub-tab
    const agentsMdBtn = screen.getByRole('button', { name: /AGENTS\.md/ })
    expect(agentsMdBtn.querySelector('span.bg-amber')).toBeTruthy()
  })

  it('Files tab: save calls API and shows toast', async () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Edit AGENTS.md...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Edit AGENTS.md...')
    fireEvent.change(textarea, { target: { value: 'new content' } })

    const saveBtn = screen.getByRole('button', { name: 'Save' })
    await act(async () => {
      fireEvent.click(saveBtn)
    })

    expect(saveAgentFile).toHaveBeenCalledWith('archimedes', 'AGENTS.md', 'new content')
    expect(onToast).toHaveBeenCalledWith({ message: 'AGENTS.md saved', variant: 'success' })
  })

  it('Files tab: discard restores original content', async () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Edit AGENTS.md...')).toBeInTheDocument()
    })

    const textarea = screen.getByPlaceholderText('Edit AGENTS.md...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'modified' } })
    expect(textarea.value).toBe('modified')

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(textarea.value).toBe('# Test Agent\nSome content')
  })

  it('Files tab: switching sub-tabs preserves unsaved state', async () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Edit AGENTS.md...')).toBeInTheDocument()
    })

    // Edit AGENTS.md
    const textarea = screen.getByPlaceholderText('Edit AGENTS.md...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'my edits' } })

    // Switch to SOUL.md
    fireEvent.click(screen.getByRole('button', { name: /SOUL\.md/ }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Edit SOUL.md...')).toBeInTheDocument()
    })

    // Switch back to AGENTS.md
    fireEvent.click(screen.getByRole('button', { name: /AGENTS\.md/ }))
    await waitFor(() => {
      const ta = screen.getByPlaceholderText('Edit AGENTS.md...') as HTMLTextAreaElement
      expect(ta.value).toBe('my edits')
    })
  })

  it('shows character count', async () => {
    render(<AgentDetailPanel agent={mockAgent} onClose={onClose} onToast={onToast} />)

    fireEvent.click(screen.getByRole('button', { name: 'Files' }))

    await waitFor(() => {
      expect(screen.getByText(/chars$/)).toBeInTheDocument()
    })
  })
})
