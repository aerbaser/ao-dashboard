import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { AgentEvent, AgentInfo } from '../../lib/api'
import { fetchAgentInboxMd, fetchAgentLog, fetchAgentEvents, sendAgentMessage, wakeAgent } from '../../lib/api'
import MailboxViewer from './MailboxViewer'

const TABS = ['Mailbox', 'INBOX.md', 'Comm Log', 'Events', 'Info'] as const

interface AgentDetailProps {
  agent: AgentInfo
  onClose: () => void
  onToast: (message: string) => void
}

export default function AgentDetail({ agent, onClose, onToast }: AgentDetailProps) {
  const [tab, setTab] = useState<string>('Mailbox')
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)

  const handleSendMessage = async () => {
    if (!messageText.trim()) return
    setSending(true)
    try {
      const result = await sendAgentMessage(agent.id, messageText.trim())
      if (result.ok) {
        onToast('Message sent')
        setMessageText('')
      } else {
        onToast(`Send failed: ${result.error}`)
      }
    } catch {
      onToast('Send failed')
    } finally {
      setSending(false)
    }
  }

  const handleWake = async () => {
    try {
      const result = await wakeAgent(agent.id)
      if (result.ok) {
        onToast(`${agent.name} woken`)
      } else {
        onToast(`Wake failed: ${result.error}`)
      }
    } catch {
      onToast('Wake failed')
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-panel-detail max-w-full bg-bg-elevated border-l border-border-subtle z-50 flex flex-col animate-slide-in-right shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle shrink-0">
          <span className="text-2xl">{agent.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-text-primary">{agent.name}</div>
            <div className="text-[11px] text-text-tertiary">{agent.role} · {agent.status}</div>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary transition-colors text-lg px-1"
          >
            &times;
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle shrink-0">
          <input
            type="text"
            value={messageText}
            onChange={e => setMessageText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSendMessage() }}
            placeholder="Send message..."
            className="flex-1 bg-bg-void border border-border-default rounded px-2 py-1 text-[12px] font-mono text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-amber"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !messageText.trim()}
            className="px-3 py-1 rounded text-[11px] font-semibold bg-accent-amber text-text-inverse hover:bg-accent-amber/90 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
          <button
            onClick={handleWake}
            className="px-3 py-1 rounded text-[11px] border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Wake
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-border-subtle shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-1 rounded text-[11px] whitespace-nowrap transition-colors ${
                tab === t
                  ? 'bg-accent-amber-subtle text-accent-amber'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
          {tab === 'Mailbox' && (
            <MailboxViewer agentId={agent.id} onToast={onToast} />
          )}
          {tab === 'INBOX.md' && (
            <InboxMdTab agentId={agent.id} />
          )}
          {tab === 'Comm Log' && (
            <CommLogTab agentId={agent.id} />
          )}
          {tab === 'Events' && (
            <EventsTab agentId={agent.id} />
          )}
          {tab === 'Info' && (
            <InfoTab agent={agent} />
          )}
        </div>
      </div>
    </>
  )
}

function InboxMdTab({ agentId }: { agentId: string }) {
  const [content, setContent] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const md = await fetchAgentInboxMd(agentId)
      setContent(md)
    } catch {
      setContent('')
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  if (content === null) return <Loading />

  if (!content) {
    return <div className="text-[12px] text-text-tertiary py-8 text-center">No INBOX.md found</div>
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none text-[12px] text-text-secondary [&_h1]:text-text-primary [&_h2]:text-text-primary [&_h3]:text-text-primary [&_a]:text-accent-blue [&_code]:text-accent-amber [&_code]:bg-bg-surface [&_code]:px-1 [&_code]:rounded [&_pre]:bg-bg-void [&_pre]:border [&_pre]:border-border-subtle [&_pre]:rounded">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

function CommLogTab({ agentId }: { agentId: string }) {
  const [content, setContent] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const md = await fetchAgentLog(agentId)
      setContent(md)
    } catch {
      setContent('')
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  if (content === null) return <Loading />

  if (!content) {
    return <div className="text-[12px] text-text-tertiary py-8 text-center">No communication log</div>
  }

  return (
    <pre className="whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-bg-void p-3 text-[11px] font-mono text-text-secondary">
      {content}
    </pre>
  )
}

function EventsTab({ agentId }: { agentId: string }) {
  const [events, setEvents] = useState<AgentEvent[] | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchAgentEvents(agentId)
      setEvents(data)
    } catch {
      setEvents([])
    }
  }, [agentId])

  useEffect(() => { load() }, [load])

  if (events === null) return <Loading />

  if (events.length === 0) {
    return <div className="text-[12px] text-text-tertiary py-8 text-center">No events</div>
  }

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <div key={i} className="bg-bg-surface border border-border-subtle rounded p-2 text-[11px] font-mono text-text-secondary">
          <div className="mb-1 flex items-center justify-between gap-3 text-[10px] text-text-tertiary">
            <span>{event.event_type ?? 'event'}</span>
            <span>{event.timestamp ?? 'unknown time'}</span>
          </div>
          <pre className="whitespace-pre-wrap">{JSON.stringify(event, null, 2)}</pre>
        </div>
      ))}
    </div>
  )
}

function InfoTab({ agent }: { agent: AgentInfo }) {
  return (
    <div className="space-y-3">
      <InfoRow label="Agent ID" value={agent.id} />
      <InfoRow label="Name" value={agent.name} />
      <InfoRow label="Role" value={agent.role} />
      <InfoRow label="Status" value={agent.status} />
      <InfoRow label="Task ID" value={agent.current_task_id ?? 'none'} />
      <InfoRow label="Current Step" value={agent.current_step ?? 'none'} />
      <InfoRow label="Progress" value={agent.progress_note ?? 'none'} />
      <InfoRow label="Checkpoint Safe" value={agent.checkpoint_safe === null ? 'unknown' : agent.checkpoint_safe ? 'yes' : 'no'} />
      <InfoRow label="Last Seen" value={agent.last_seen ?? 'never'} />
      <InfoRow label="Session Key" value={agent.session_key ?? 'unknown'} />
      <InfoRow label="Workspace" value={agent.workspace_path ?? 'unknown'} />
      <InfoRow label="Topic ID" value={agent.topic_id === null ? 'unknown' : String(agent.topic_id)} />
      <div className="pt-2 border-t border-border-subtle">
        <div className="text-[10px] text-text-disabled mb-1">Heartbeat paths</div>
        <div className="text-[11px] font-mono text-text-tertiary">~/clawd/runtime/heartbeats/{agent.id}.json</div>
        <div className="text-[11px] font-mono text-text-tertiary">~/clawd/runtime/mailboxes/{agent.id}/</div>
      </div>
      <div className="pt-2 border-t border-border-subtle">
        <div className="text-[10px] text-text-disabled mb-1">Last heartbeat raw JSON</div>
        <pre className="max-h-64 overflow-auto rounded-md border border-border-subtle bg-bg-void p-3 text-[11px] font-mono text-text-secondary">
          {JSON.stringify(agent.heartbeat_raw ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-[11px] text-text-tertiary w-28 shrink-0">{label}</span>
      <span className="text-[12px] font-mono text-text-secondary break-all">{value}</span>
    </div>
  )
}

function Loading() {
  return <div className="text-[11px] text-text-tertiary py-4 text-center">Loading...</div>
}
