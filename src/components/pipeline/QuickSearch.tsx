import { useState, useEffect, useRef, useMemo } from 'react'
import type { Task } from '../../lib/types'

interface QuickSearchProps {
  tasks: Task[]
  open: boolean
  onSelect: (task: Task) => void
  onClose: () => void
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark
        data-testid="quick-search-highlight"
        className="bg-amber-subtle text-amber rounded-sm px-0.5"
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function QuickSearch({ tasks, open, onSelect, onClose }: QuickSearchProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.toLowerCase()
    return tasks
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.id.toLowerCase().startsWith(q)
      )
      .slice(0, 10)
  }, [tasks, query])

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(0)
      // Focus input after render
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Keep activeIndex in bounds
  useEffect(() => {
    if (activeIndex >= results.length) {
      setActiveIndex(Math.max(0, results.length - 1))
    }
  }, [results.length, activeIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[activeIndex]) {
          onSelect(results[activeIndex])
        }
        break
    }
  }

  if (!open) return null

  return (
    <>
      <div
        data-testid="quick-search-backdrop"
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-[480px] max-w-[90vw] bg-bg-elevated border border-border-subtle rounded-lg shadow-panel animate-fade-in">
        <div className="p-3 border-b border-border-subtle">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks by title or ID..."
            className="w-full bg-bg-void border border-border-default rounded-sm px-3 py-2 text-sm font-mono text-text-primary focus:border-amber focus:outline-none"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1">
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-text-tertiary">
              No tasks found
            </div>
          ) : (
            results.map((task, i) => (
              <button
                key={task.id}
                data-testid="quick-search-result"
                data-active={i === activeIndex ? 'true' : 'false'}
                onClick={() => onSelect(task)}
                className={`w-full text-left px-3 py-2 rounded-sm flex items-center gap-3 transition-colors ${
                  i === activeIndex
                    ? 'bg-bg-hover text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover'
                }`}
              >
                <span className="text-xs font-mono text-text-tertiary shrink-0">
                  {task.id}
                </span>
                <span className="text-sm truncate">
                  {highlightMatch(task.title, query)}
                </span>
                <span className="ml-auto text-[10px] font-mono text-text-disabled shrink-0">
                  {task.state}
                </span>
              </button>
            ))
          )}
        </div>
        <div className="px-3 py-2 border-t border-border-subtle flex gap-3 text-[10px] text-text-disabled font-mono">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </>
  )
}
