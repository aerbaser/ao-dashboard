import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import type { AgentInfo } from '../../lib/api'
import { fetchAgentFile, saveAgentFile } from '../../lib/api'
import AgentAvatar from './AgentAvatar'
import type { ToastPayload } from '../../hooks/useToast'
import SkillsManager from './SkillsManager'
import ModelSelector from './ModelSelector'

const TABS = ['Skills', 'Files', 'Model'] as const
type Tab = (typeof TABS)[number]

const WORKSPACE_FILES = ['AGENTS.md', 'SOUL.md', 'TOOLS.md'] as const
type WorkspaceFile = (typeof WORKSPACE_FILES)[number]

interface AgentDetailPanelProps {
  agent: AgentInfo
  onClose: () => void
  onToast: (toast: ToastPayload) => void
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

const STATUS_DOT: Record<string, string> = {
  active:  'bg-status-healthy',
  idle:    'bg-status-idle',
  dead:    'bg-status-critical',
  waiting: 'bg-accent-purple',
  unknown: 'bg-text-disabled',
}

export default function AgentDetailPanel({ agent, onClose, onToast }: AgentDetailPanelProps) {
  const [tab, setTab] = useState<Tab>('Skills')

  return (
    <div className="animate-slide-down border border-border-subtle rounded-lg bg-bg-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
        <AgentAvatar name={agent.name} id={agent.id} status={agent.status} size={40} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary text-md">{agent.emoji} {agent.name}</span>
            <span className="text-xs font-mono text-text-tertiary">({agent.id})</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-secondary flex-wrap">
            <span>{agent.role}</span>
            <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[agent.status] ?? STATUS_DOT.unknown}`} />
            <span>{agent.status}</span>
            {agent.model && (
              <span className="px-1.5 py-0.5 rounded bg-bg-overlay text-xs font-mono text-text-tertiary">
                {agent.model}
              </span>
            )}
            <span className="text-text-tertiary">{relativeTime(agent.last_seen)}</span>
            {agent.current_task_id && (
              <a
                href={`/pipeline?task=${agent.current_task_id}`}
                className="text-accent-amber hover:underline font-mono"
              >
                {agent.current_task_id}
              </a>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary transition-colors text-lg px-2 py-1 rounded hover:bg-bg-hover"
          aria-label="Close detail panel"
        >
          &#x2715;
        </button>
      </div>

      {/* Tab bar with underline indicator */}
      <div className="flex border-b border-border-subtle px-4 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
              tab === t
                ? 'text-amber'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-amber" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4 min-h-[200px]">
        {tab === 'Skills' && <SkillsManager agentId={agent.id} onToast={onToast} />}
        {tab === 'Files' && <FilesTab agentId={agent.id} onToast={onToast} />}
        {tab === 'Model' && <ModelSelector agent={agent} currentModel={agent.model ?? ''} onToast={onToast} />}
      </div>
    </div>
  )
}

// ─── Files Tab ──────────────────────────────────────────────────────────────

interface FileState {
  original: string
  draft: string
  loading: boolean
}

function FilesTab({ agentId, onToast }: { agentId: string; onToast: (t: ToastPayload) => void }) {
  const [activeFile, setActiveFile] = useState<WorkspaceFile>('AGENTS.md')
  const [files, setFiles] = useState<Record<WorkspaceFile, FileState>>({
    'AGENTS.md': { original: '', draft: '', loading: true },
    'SOUL.md':   { original: '', draft: '', loading: true },
    'TOOLS.md':  { original: '', draft: '', loading: true },
  })
  const [saving, setSaving] = useState(false)

  const loadFile = useCallback(async (filename: WorkspaceFile) => {
    setFiles(prev => ({
      ...prev,
      [filename]: { ...prev[filename], loading: true },
    }))
    try {
      const { content } = await fetchAgentFile(agentId, filename)
      setFiles(prev => ({
        ...prev,
        [filename]: { original: content, draft: content, loading: false },
      }))
    } catch {
      setFiles(prev => ({
        ...prev,
        [filename]: { original: '', draft: '', loading: false },
      }))
    }
  }, [agentId])

  useEffect(() => {
    for (const f of WORKSPACE_FILES) {
      loadFile(f)
    }
  }, [loadFile])

  const current = files[activeFile]
  const hasUnsaved = current.draft !== current.original

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveAgentFile(agentId, activeFile, current.draft)
      if (result.ok) {
        setFiles(prev => ({
          ...prev,
          [activeFile]: { ...prev[activeFile], original: current.draft },
        }))
        onToast({ message: `${activeFile} saved`, variant: 'success' })
      } else {
        onToast({ message: `Save failed: ${result.error}`, variant: 'error' })
      }
    } catch {
      onToast({ message: 'Save failed', variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setFiles(prev => ({
      ...prev,
      [activeFile]: { ...prev[activeFile], draft: prev[activeFile].original },
    }))
  }

  const handleDraftChange = (value: string) => {
    setFiles(prev => ({
      ...prev,
      [activeFile]: { ...prev[activeFile], draft: value },
    }))
  }

  return (
    <div className="space-y-3">
      {/* File sub-tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {WORKSPACE_FILES.map(f => {
          const isUnsaved = files[f].draft !== files[f].original
          return (
            <button
              key={f}
              onClick={() => setActiveFile(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                activeFile === f
                  ? 'bg-amber-subtle text-amber'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
              }`}
            >
              {f}
              {isUnsaved && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber" title="Unsaved changes" />
              )}
            </button>
          )
        })}
      </div>

      {current.loading ? (
        <div className="text-xs text-text-tertiary py-8 text-center">Loading...</div>
      ) : (
        <>
          {/* Split view: preview on top, editor on bottom. Mobile: editor only */}
          <div className="hidden md:block">
            <div className="border border-border-subtle rounded-md bg-bg-surface p-3 max-h-[200px] overflow-y-auto scrollbar-thin">
              {current.draft ? (
                <div className="prose prose-invert prose-sm max-w-none text-xs text-text-secondary [&_h1]:text-text-primary [&_h2]:text-text-primary [&_h3]:text-text-primary [&_a]:text-blue [&_code]:text-amber [&_code]:bg-bg-void [&_code]:px-1 [&_code]:rounded [&_pre]:bg-bg-void [&_pre]:border [&_pre]:border-border-subtle [&_pre]:rounded">
                  <ReactMarkdown>{current.draft}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-xs text-text-disabled text-center py-4">Empty file</div>
              )}
            </div>
          </div>

          {/* Editor */}
          <textarea
            value={current.draft}
            onChange={e => handleDraftChange(e.target.value)}
            className="w-full bg-bg-void border border-border-default rounded-md px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-amber resize-y min-h-[120px] max-h-[300px] scrollbar-thin"
            placeholder={`Edit ${activeFile}...`}
            spellCheck={false}
          />

          {/* Footer: char count + actions */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-disabled font-mono">
              {current.draft.length} chars
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleDiscard}
                disabled={!hasUnsaved}
                className="px-3 py-1 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border-subtle disabled:opacity-30 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={!hasUnsaved || saving}
                className="px-3 py-1 rounded text-xs font-semibold bg-amber text-text-inverse hover:bg-amber/90 disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
