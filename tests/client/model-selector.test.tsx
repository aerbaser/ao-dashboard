import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  changeAgentModel: vi.fn(),
  getStatus: vi.fn(),
}))

import ModelSelector from '../../src/components/agents/ModelSelector'
import { changeAgentModel, getStatus } from '../../src/lib/api'
import type { AgentInfo } from '../../src/lib/api'

const mockAgent: AgentInfo = {
  id: 'archimedes',
  name: 'Архимед',
  emoji: '🔧',
  role: 'Engineer',
  status: 'active',
  current_task_id: null,
  current_step: null,
  progress_note: null,
  checkpoint_safe: null,
  last_seen: null,
  session_key: null,
  workspace_path: null,
  topic_id: null,
  heartbeat_raw: null,
  mailbox: { inbox: 0, processing: 0, done: 0, deadletter: 0 },
}

describe('ModelSelector', () => {
  const onToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('shows current model as badge', () => {
    render(
      <ModelSelector agent={mockAgent} currentModel="claude-opus-4-6" onToast={onToast} />
    )
    expect(screen.getByText('claude-opus-4-6')).toBeInTheDocument()
  })

  it('shows dropdown with available models', () => {
    render(
      <ModelSelector agent={mockAgent} currentModel="claude-opus-4-6" onToast={onToast} />
    )
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
  })

  it('shows warning card when new model selected', () => {
    render(
      <ModelSelector agent={mockAgent} currentModel="claude-opus-4-6" onToast={onToast} />
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    expect(screen.getByText(/Gateway Restart Required/)).toBeInTheDocument()
  })

  it('type-to-confirm blocks until name matches', () => {
    render(
      <ModelSelector agent={mockAgent} currentModel="claude-opus-4-6" onToast={onToast} />
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    const confirmBtn = screen.getByRole('button', { name: /confirm change/i })
    expect(confirmBtn).toBeDisabled()
  })

  it('POST triggers model update on confirm', async () => {
    vi.mocked(changeAgentModel).mockResolvedValue({ ok: true, restarting: true })
    vi.mocked(getStatus).mockResolvedValue({
      gateway_up: true, agents_alive: 1, agents_total: 1,
      active_tasks: 0, blocked_tasks: 0, stuck_tasks: 0,
      failed_services: 0, cpu_percent: 0, cpu_temp: 0,
      claude_usage_percent: 0, codex_usage_percent: 0, timestamp: '',
    })

    render(
      <ModelSelector agent={mockAgent} currentModel="claude-opus-4-6" onToast={onToast} />
    )
    // Select new model
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    // Type agent id to confirm
    const input = screen.getByPlaceholderText('archimedes')
    fireEvent.change(input, { target: { value: 'archimedes' } })
    // Click confirm
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /confirm change/i }))
    })

    expect(changeAgentModel).toHaveBeenCalledWith('archimedes', 'claude-sonnet-4-6')
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'warning', message: expect.stringContaining('Restarting gateway') })
    )
  })

  it('cancel dismisses without changes', () => {
    render(
      <ModelSelector agent={mockAgent} currentModel="claude-opus-4-6" onToast={onToast} />
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    expect(screen.getByText(/Gateway Restart Required/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText(/Gateway Restart Required/)).not.toBeInTheDocument()
    expect(changeAgentModel).not.toHaveBeenCalled()
  })
})
