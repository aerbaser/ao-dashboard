import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import Skeleton from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'

interface LogViewerProps {
  lines: string[]
  loading?: boolean
  error?: string
  paused?: boolean
}

type LogLevel = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'
const ALL_LEVELS: LogLevel[] = ['ERROR', 'WARN', 'INFO', 'DEBUG']

function detectLevel(line: string): LogLevel {
  if (/\bERROR\b/.test(line)) return 'ERROR'
  if (/\bWARN(?:ING)?\b/.test(line)) return 'WARN'
  if (/\bDEBUG\b/.test(line)) return 'DEBUG'
  return 'INFO'
}

const levelStyles: Record<LogLevel, string> = {
  ERROR: 'text-accent-red bg-accent-red-subtle',
  WARN: 'text-accent-amber',
  INFO: 'text-text-secondary',
  DEBUG: 'text-text-tertiary',
}

export default function LogViewer({ lines, loading, error, paused }: LogViewerProps) {
  const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(new Set(ALL_LEVELS))
  const [keyword, setKeyword] = useState('')
  const [expandedLine, setExpandedLine] = useState<number | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  const filteredLines = useMemo(() => {
    return lines
      .map((line, i) => ({ line, index: i, level: detectLevel(line) }))
      .filter(({ level }) => selectedLevels.has(level))
      .filter(({ line }) => !keyword || line.toLowerCase().includes(keyword.toLowerCase()))
  }, [lines, selectedLevels, keyword])

  const virtualizer = useVirtualizer({
    count: filteredLines.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 20,
  })

  // Auto-scroll to bottom when not paused
  useEffect(() => {
    if (!paused && shouldAutoScroll.current && parentRef.current) {
      virtualizer.scrollToIndex(filteredLines.length - 1, { align: 'end' })
    }
  }, [filteredLines.length, paused, virtualizer])

  // Track if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    if (!parentRef.current || paused) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    shouldAutoScroll.current = scrollHeight - scrollTop - clientHeight < 50
  }, [paused])

  // When paused, lock scroll position
  useEffect(() => {
    if (paused) {
      shouldAutoScroll.current = false
    } else {
      shouldAutoScroll.current = true
    }
  }, [paused])

  function toggleLevel(level: LogLevel) {
    setSelectedLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }

  function tryParseJson(line: string): string | null {
    // Try to extract JSON from the log line
    const jsonMatch = line.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.stringify(JSON.parse(jsonMatch[0]), null, 2)
      } catch {
        return null
      }
    }
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-surface">
        {ALL_LEVELS.map((level) => (
          <button
            key={level}
            onClick={() => toggleLevel(level)}
            className={`px-2 py-0.5 rounded-sm text-xs font-mono transition-colors ${
              selectedLevels.has(level)
                ? level === 'ERROR'
                  ? 'bg-accent-red-subtle text-accent-red'
                  : level === 'WARN'
                    ? 'bg-accent-amber-subtle text-accent-amber'
                    : level === 'INFO'
                      ? 'bg-bg-elevated text-text-secondary'
                      : 'bg-bg-elevated text-text-tertiary'
                : 'bg-bg-void text-text-disabled'
            }`}
          >
            {level}
          </button>
        ))}
        <input
          type="text"
          placeholder="Filter by keyword…"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="ml-2 flex-1 bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm focus:border-accent-amber focus:outline-none"
        />
        <span className="text-xs text-text-tertiary font-mono">
          {filteredLines.length}/{lines.length}
        </span>
      </div>

      {/* Log content */}
      {error ? (
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
          {error}
        </div>
      ) : loading && lines.length === 0 ? (
        <div className="p-3 space-y-2">
          <Skeleton lines={8} height="16px" className="w-full" />
        </div>
      ) : (
        <div
          ref={parentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto font-mono text-xs max-w-full"
        >
          {filteredLines.length === 0 && !loading && !error ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="≡" title="No log entries" description="Nothing to show yet" />
            </div>
          ) : null}
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = filteredLines[virtualRow.index]
              if (!item) return null
              const isExpanded = expandedLine === item.index
              const jsonDetail = isExpanded ? tryParseJson(item.line) : null

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div
                    onClick={() => setExpandedLine(isExpanded ? null : item.index)}
                    className={`px-3 py-0.5 cursor-pointer hover:bg-bg-hover leading-relaxed break-all ${levelStyles[item.level]}`}
                  >
                    {item.line}
                  </div>
                  {isExpanded && jsonDetail && (
                    <pre className="px-6 py-2 bg-bg-elevated text-text-secondary text-xs border-l-2 border-accent-amber whitespace-pre-wrap">
                      {jsonDetail}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
