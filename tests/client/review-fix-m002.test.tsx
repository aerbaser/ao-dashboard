import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToastProvider } from '../../src/hooks/useToast'
import ToastStack from '../../src/components/layout/Toast'

vi.mock('../../src/components/agents/AgentGrid', () => ({
  default: function MockAgentGrid({ onSelectAgent }: { onSelectAgent: (agent: unknown) => void }) {
    return (
      <button
        type="button"
        onClick={() => onSelectAgent({
          id: 'agent-1',
          name: 'Test Agent',
          emoji: 'A',
          role: 'Operator',
          status: 'idle',
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
        })}
      >
        select agent
      </button>
    )
  },
}))

vi.mock('../../src/components/agents/AgentDetail', () => ({
  default: function MockAgentDetail({
    onToast,
  }: {
    onToast: (toast: { message: string; variant: 'success' | 'error' | 'warning' | 'info' }) => void
  }) {
    return (
      <button
        type="button"
        onClick={() => onToast({ message: 'Message sent', variant: 'success' })}
      >
        trigger agent toast
      </button>
    )
  },
}))

const mockTransitionTask = vi.fn()

vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/api')>('../../src/lib/api')
  return {
    ...actual,
    transitionTask: (...args: Parameters<typeof actual.transitionTask>) => mockTransitionTask(...args),
  }
})

vi.mock('@dnd-kit/core', () => ({
  DndContext: function MockDndContext({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: React.ReactNode
    onDragStart?: (event: { active: { id: string } }) => void
    onDragEnd?: (event: { active: { id: string }; over: { id: string } }) => void
  }) {
    return (
      <div>
        {children}
        <button
          type="button"
          onClick={() => {
            onDragStart?.({ active: { id: 'task-1' } })
            onDragEnd?.({ active: { id: 'task-1' }, over: { id: 'DONE' } })
          }}
        >
          simulate drop
        </button>
      </div>
    )
  },
  DragOverlay: function MockDragOverlay({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  },
  closestCorners: vi.fn(),
  KeyboardSensor: function KeyboardSensor() { return null },
  PointerSensor: function PointerSensor() { return null },
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: vi.fn(() => null),
  useSensors: vi.fn(() => []),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: function MockSortableContext({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  },
  verticalListSortingStrategy: {},
}))

vi.mock('../../src/components/pipeline/TaskCard', () => ({
  TaskCard: function MockTaskCard({
    task,
    onClick,
  }: {
    task: { id: string; title: string }
    onClick: (task: { id: string; title: string }) => void
  }) {
    return (
      <button type="button" onClick={() => onClick(task)}>
        {task.title}
      </button>
    )
  },
}))

import AgentsPage from '../../src/pages/AgentsPage'
import { KanbanBoard } from '../../src/components/pipeline/KanbanBoard'

describe('audit fix m-002', () => {
  beforeEach(() => {
    mockTransitionTask.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('routes agent detail toasts through the shared toast stack', async () => {
    render(
      <ToastProvider>
        <AgentsPage />
        <ToastStack />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'select agent' }))
    fireEvent.click(screen.getByRole('button', { name: 'trigger agent toast' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Message sent')
  })

  it('routes successful task transitions through the shared toast stack', async () => {
    mockTransitionTask.mockResolvedValue({ ok: true })

    render(
      <ToastProvider>
        <KanbanBoard
          tasks={[{
            id: 'task-1',
            state: 'INTAKE',
            owner: 'archimedes',
            route: 'build_route',
            title: 'Task one',
            age: null,
            ttl: null,
            blockers: 0,
            retries: 0,
            terminal: false,
            hasQuality: false,
            hasOutcome: false,
            hasRelease: false,
          }]}
          onCardClick={vi.fn()}
          onRefresh={vi.fn()}
        />
        <ToastStack />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'simulate drop' }))

    expect(await screen.findByText('Moved task to DONE')).toBeTruthy()
  })
})
