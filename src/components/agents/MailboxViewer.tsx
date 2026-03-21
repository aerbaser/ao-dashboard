import { useState, useEffect, useCallback } from 'react'
import type { Envelope } from '../../lib/api'
import { fetchAgentMailbox, deleteEnvelope, moveEnvelope } from '../../lib/api'

const FOLDERS = ['inbox', 'processing', 'done', 'deadletter'] as const

interface MailboxViewerProps {
  agentId: string
  onToast: (message: string) => void
}

export default function MailboxViewer({ agentId, onToast }: MailboxViewerProps) {
  const [folder, setFolder] = useState<string>('inbox')
  const [envelopes, setEnvelopes] = useState<Envelope[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAgentMailbox(agentId, folder)
      setEnvelopes(data)
    } catch {
      setEnvelopes([])
    } finally {
      setLoading(false)
    }
  }, [agentId, folder])

  useEffect(() => { load() }, [load])

  const handleDelete = async (envId: string) => {
    const result = await deleteEnvelope(agentId, folder, envId)
    if (result.ok) {
      onToast('Envelope deleted')
      load()
    } else {
      onToast(`Delete failed: ${result.error}`)
    }
  }

  const handleRetry = async (envId: string) => {
    const result = await moveEnvelope(agentId, folder, 'inbox', envId)
    if (result.ok) {
      onToast('Moved to inbox')
      load()
    } else {
      onToast(`Move failed: ${result.error}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 border-b border-border-subtle pb-2 mb-3">
        {FOLDERS.map(f => (
          <button
            key={f}
            onClick={() => setFolder(f)}
            className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
              folder === f
                ? 'bg-accent-amber-subtle text-accent-amber'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-[11px] text-text-tertiary py-4 text-center">Loading...</div>
      ) : envelopes.length === 0 ? (
        <div className="text-[12px] text-text-tertiary py-8 text-center">
          No messages in {folder}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2">
          {envelopes.map(env => (
            <div key={env.id} className="bg-bg-surface border border-border-subtle rounded p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-text-primary truncate">
                    {env.subject}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-text-tertiary">from: {env.from}</span>
                    <span className="text-[10px] text-text-tertiary">type: {env.type}</span>
                    <PriorityBadge priority={env.priority} />
                  </div>
                  <div className="text-[10px] text-text-disabled mt-1 font-mono">
                    {env.created_at}
                    {env.expires_at && ` · expires: ${env.expires_at}`}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {folder === 'deadletter' && (
                    <button
                      onClick={() => handleRetry(env.id)}
                      className="px-2 py-0.5 text-[10px] rounded bg-accent-amber-subtle text-accent-amber hover:bg-accent-amber/20 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(env.id)}
                    className="px-2 py-0.5 text-[10px] rounded bg-accent-red-subtle text-accent-red hover:bg-accent-red/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    P0: 'bg-accent-red-subtle text-accent-red',
    P1: 'bg-accent-amber-subtle text-accent-amber',
    P2: 'bg-accent-blue-subtle text-accent-blue',
    P3: 'bg-bg-hover text-text-tertiary',
  }
  return (
    <span className={`px-1 py-0 rounded text-[9px] font-mono ${colors[priority] ?? colors.P2}`}>
      {priority}
    </span>
  )
}
