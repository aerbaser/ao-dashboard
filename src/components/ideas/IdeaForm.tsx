import { useState, useRef, useEffect } from 'react'

interface IdeaFormProps {
  onSubmit: (data: { title: string; body: string; tags: string[]; target_agent: string }) => void
  onCancel: () => void
  submitting?: boolean
}

const AGENTS = [
  { value: 'brainstorm-claude', label: 'Brainstorm Claude' },
  { value: 'brainstorm-codex', label: 'Brainstorm Codex' },
  { value: 'archimedes', label: 'Archimedes' },
  { value: 'sokrat', label: 'Sokrat' },
]

export default function IdeaForm({ onSubmit, onCancel, submitting }: IdeaFormProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [targetAgent, setTargetAgent] = useState('brainstorm-claude')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSubmit({ title: title.trim(), body: body.trim(), tags, target_agent: targetAgent })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-surface border border-border-subtle rounded-md p-4 animate-fade-in"
    >
      <div className="space-y-3">
        <div>
          <input
            ref={titleRef}
            type="text"
            placeholder="Idea title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-bg-elevated border border-border-default rounded-sm px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-amber"
          />
        </div>

        <div>
          <textarea
            placeholder="Description (markdown)..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full bg-bg-elevated border border-border-default rounded-sm px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-amber resize-y"
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <select
              value={targetAgent}
              onChange={(e) => setTargetAgent(e.target.value)}
              className="w-full bg-bg-elevated border border-border-default rounded-sm px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber"
            >
              {AGENTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full bg-bg-elevated border border-border-default rounded-sm px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-amber"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="px-4 py-1.5 text-sm font-medium rounded-sm bg-amber text-text-inverse hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {submitting ? 'Creating...' : 'Create Idea'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 text-sm rounded-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
