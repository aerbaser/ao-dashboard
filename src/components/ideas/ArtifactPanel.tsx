import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CopyButton from '../ui/CopyButton'
import ConfirmDialog from '../ui/ConfirmDialog'
import { updateIdea, approveIdea } from '../../lib/api'

interface ArtifactPanelProps {
  artifact: string
  ideaId: string
  onApprove: (taskId: string) => void
}

export default function ArtifactPanel({ artifact, ideaId, onApprove }: ArtifactPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(artifact)
  const [currentArtifact, setCurrentArtifact] = useState(artifact)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)

  const previewLines = currentArtifact.split('\n').slice(0, 3).join('\n')

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateIdea(ideaId, { artifact_md: editText })
      setCurrentArtifact(editText)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    setEditText(currentArtifact)
    setEditing(false)
  }

  const handleApprove = async () => {
    setShowConfirm(false)
    setApproving(true)
    try {
      const result = await approveIdea(ideaId)
      onApprove(result.task_id)
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="bg-bg-elevated border border-border-subtle rounded-sm p-3 mt-2">
      {!expanded ? (
        /* Collapsed state */
        <div>
          <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap line-clamp-3 mb-2">
            {previewLines}
          </pre>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-amber hover:text-amber/80 transition-colors"
          >
            ▼ Show artifact
          </button>
        </div>
      ) : (
        /* Expanded state */
        <div>
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => { setExpanded(false); setEditing(false) }}
              className="text-xs text-amber hover:text-amber/80 transition-colors"
            >
              ▲ Hide artifact
            </button>
          </div>

          {editing ? (
            /* Edit mode: split preview + textarea */
            <div className="space-y-2">
              <div className="max-h-[200px] overflow-y-auto border border-border-subtle rounded-sm p-3 bg-bg-surface">
                <div className="prose prose-invert prose-sm max-w-none text-xs text-text-secondary [&_h1]:text-text-primary [&_h2]:text-text-primary [&_h3]:text-text-primary [&_a]:text-blue [&_code]:text-amber [&_code]:bg-bg-surface [&_code]:px-1 [&_code]:rounded [&_pre]:bg-bg-void [&_pre]:border [&_pre]:border-border-subtle [&_pre]:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{editText}</ReactMarkdown>
                </div>
              </div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full h-[160px] bg-bg-void border border-border-default rounded-sm px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-amber resize-y"
                data-testid="artifact-textarea"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1 text-xs font-medium bg-amber hover:bg-amber/80 text-text-inverse rounded-sm transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={handleDiscard}
                  className="px-3 py-1 text-xs text-text-secondary hover:text-text-primary rounded-sm transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          ) : (
            /* View mode: rendered markdown */
            <div>
              <div className="max-h-[400px] overflow-y-auto border border-border-subtle rounded-sm p-3 bg-bg-surface">
                <div className="prose prose-invert prose-sm max-w-none text-xs text-text-secondary [&_h1]:text-text-primary [&_h2]:text-text-primary [&_h3]:text-text-primary [&_a]:text-blue [&_code]:text-amber [&_code]:bg-bg-surface [&_code]:px-1 [&_code]:rounded [&_pre]:bg-bg-void [&_pre]:border [&_pre]:border-border-subtle [&_pre]:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentArtifact}</ReactMarkdown>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-2">
                <CopyButton text={currentArtifact} className="opacity-100 text-text-secondary hover:text-text-primary" />
                <button
                  onClick={() => { setEditText(currentArtifact); setEditing(true) }}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                  title="Edit artifact"
                >
                  ✏ Edit
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={approving}
                  className="text-xs text-emerald hover:text-emerald/80 transition-colors disabled:opacity-50"
                  data-testid="approve-button"
                >
                  {approving ? 'Creating task…' : '✅ Approve → Create Task'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showConfirm && (
        <ConfirmDialog
          title="Approve Idea"
          message="This will create a task from this idea and notify Платон for decomposition."
          confirmLabel="Approve"
          onConfirm={handleApprove}
          onCancel={() => setShowConfirm(false)}
          variant="warning"
        />
      )}
    </div>
  )
}
