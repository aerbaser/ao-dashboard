import { useState } from 'react'
import { createIdea } from '../../lib/api'

interface IdeaFormProps {
  onCreated: () => void
}

const AGENTS = [
  { value: 'brainstorm-claude', label: 'Brainstorm Claude' },
  { value: 'brainstorm-codex', label: 'Brainstorm Codex' },
  { value: 'archimedes', label: 'Archimedes' },
  { value: 'sokrat', label: 'Sokrat' },
]

export default function IdeaForm({ onCreated }: IdeaFormProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetAgent, setTargetAgent] = useState('brainstorm-claude')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setSubmitting(true)
    try {
      await createIdea({
        title: title.trim(),
        body: body.trim(),
        target_agent: targetAgent,
      })
      setTitle('')
      setBody('')
      setExpanded(false)
      onCreated()
    } catch (err) {
      console.error('Failed to create idea:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full text-left px-3 py-2.5 rounded-md border border-dashed border-border-default text-text-tertiary hover:text-text-secondary hover:border-border-strong transition-colors text-sm"
      >
        + New idea...
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-border-subtle bg-bg-surface p-3 space-y-2">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Idea title..."
        autoFocus
        className="w-full bg-bg-base border border-border-subtle rounded-sm px-2 py-1.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-blue"
      />
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full bg-bg-base border border-border-subtle rounded-sm px-2 py-1.5 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-blue resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <select
          value={targetAgent}
          onChange={e => setTargetAgent(e.target.value)}
          className="bg-bg-base border border-border-subtle rounded-sm px-2 py-1 text-xs text-text-secondary focus:outline-none"
        >
          {AGENTS.map(a => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setExpanded(false); setTitle(''); setBody('') }}
            className="text-xs text-text-tertiary hover:text-text-secondary px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="text-xs font-medium px-3 py-1 rounded-sm bg-amber text-text-inverse hover:bg-amber/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </form>
  )
}
