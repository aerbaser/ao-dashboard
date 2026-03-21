import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

SyntaxHighlighter.registerLanguage('json', json)

const AGENTS = ['archimedes', 'aristotle', 'brainstorm', 'devops', 'herodotus', 'leo', 'platon', 'shared']

interface FileList {
  files: string[]
  dailyDates: string[]
}

export default function MemoryBrowser() {
  const [agent, setAgent] = useState('platon')
  const [fileList, setFileList] = useState<FileList | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [contentType, setContentType] = useState<'markdown' | 'json'>('markdown')
  const [loading, setLoading] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  // Load file list when agent changes
  useEffect(() => {
    setFileList(null)
    setSelectedFile(null)
    setSelectedDate(null)
    setContent(null)

    fetch(`/api/memory/${agent}/files`)
      .then(r => r.json())
      .then(data => setFileList(data))
      .catch(() => setFileList({ files: [], dailyDates: [] }))
  }, [agent])

  // Load file content
  const loadFile = (file: string) => {
    setSelectedFile(file)
    setSelectedDate(null)
    setLoading(true)
    fetch(`/api/memory/${agent}/${file}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content)
        setContentType(data.type ?? 'markdown')
        setLoading(false)
      })
      .catch(() => {
        setContent(null)
        setLoading(false)
      })
  }

  // Load daily note
  const loadDaily = (date: string) => {
    setSelectedDate(date)
    setSelectedFile(null)
    setLoading(true)
    fetch(`/api/memory/${agent}/daily/${date}`)
      .then(r => r.json())
      .then(data => {
        setContent(data.content)
        setContentType('markdown')
        setLoading(false)
      })
      .catch(() => {
        setContent(null)
        setLoading(false)
      })
  }

  // Calendar helpers
  const [calYear, calMonth] = calendarMonth.split('-').map(Number)
  const daysInMonth = new Date(calYear, calMonth, 0).getDate()
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay()
  const availableDates = new Set(fileList?.dailyDates ?? [])

  const prevMonth = () => {
    const d = new Date(calYear, calMonth - 2, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const nextMonth = () => {
    const d = new Date(calYear, calMonth, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const mdFiles = (fileList?.files ?? []).filter(f => f.endsWith('.md'))
  const jsonFiles = (fileList?.files ?? []).filter(f => f.endsWith('.json'))

  return (
    <div className="flex gap-6 h-[calc(100vh-160px)]">
      {/* Left sidebar */}
      <div className="w-64 shrink-0 overflow-y-auto space-y-4">
        {/* Agent selector */}
        <div>
          <label className="text-xs text-text-tertiary font-semibold uppercase tracking-wider mb-1 block">
            Agent
          </label>
          <select
            value={agent}
            onChange={e => setAgent(e.target.value)}
            className="w-full bg-bg-void border border-border-default rounded-sm px-3 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:border-amber"
          >
            {AGENTS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Markdown files */}
        {mdFiles.length > 0 && (
          <div>
            <label className="text-xs text-text-tertiary font-semibold uppercase tracking-wider mb-1 block">
              Files
            </label>
            <div className="space-y-0.5">
              {mdFiles.map(f => (
                <button
                  key={f}
                  onClick={() => loadFile(f)}
                  className={`block w-full text-left px-2 py-1 rounded-sm text-sm font-mono transition-colors ${
                    selectedFile === f
                      ? 'bg-amber-subtle text-amber'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* JSON files */}
        {jsonFiles.length > 0 && (
          <div>
            <label className="text-xs text-text-tertiary font-semibold uppercase tracking-wider mb-1 block">
              JSON
            </label>
            <div className="space-y-0.5">
              {jsonFiles.map(f => (
                <button
                  key={f}
                  onClick={() => loadFile(f)}
                  className={`block w-full text-left px-2 py-1 rounded-sm text-sm font-mono transition-colors ${
                    selectedFile === f
                      ? 'bg-amber-subtle text-amber'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Calendar */}
        <div>
          <label className="text-xs text-text-tertiary font-semibold uppercase tracking-wider mb-1 block">
            Daily Notes
          </label>
          <div className="bg-bg-surface border border-border-subtle rounded-md p-2">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={prevMonth} className="text-text-tertiary hover:text-text-primary text-sm px-1">&lt;</button>
              <span className="text-xs font-mono text-text-secondary">
                {calYear}-{String(calMonth).padStart(2, '0')}
              </span>
              <button onClick={nextMonth} className="text-text-tertiary hover:text-text-primary text-sm px-1">&gt;</button>
            </div>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0 text-center mb-1">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
                <span key={d} className="text-[10px] text-text-tertiary">{d}</span>
              ))}
            </div>
            {/* Days */}
            <div className="grid grid-cols-7 gap-0 text-center">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const hasNote = availableDates.has(dateStr)
                const isSelected = selectedDate === dateStr

                return (
                  <button
                    key={day}
                    disabled={!hasNote}
                    onClick={() => hasNote && loadDaily(dateStr)}
                    className={`text-xs py-0.5 rounded-sm transition-colors ${
                      isSelected
                        ? 'bg-amber text-text-inverse font-semibold'
                        : hasNote
                          ? 'text-emerald hover:bg-bg-hover cursor-pointer font-medium'
                          : 'text-text-disabled cursor-default'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-bg-surface border border-border-subtle rounded-lg p-6">
        {loading ? (
          <div className="text-text-tertiary text-sm animate-pulse">Loading...</div>
        ) : content ? (
          <>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border-subtle">
              <span className="text-xs text-text-tertiary font-mono">
                {agent}/{selectedFile ?? `daily/${selectedDate}.md`}
              </span>
            </div>
            {contentType === 'json' ? (
              <SyntaxHighlighter
                language="json"
                style={atomOneDark}
                customStyle={{
                  background: '#0C0B0A',
                  borderRadius: '6px',
                  padding: '16px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                }}
              >
                {(() => {
                  try { return JSON.stringify(JSON.parse(content), null, 2) }
                  catch { return content }
                })()}
              </SyntaxHighlighter>
            ) : (
              <div className="prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
            Select a file or daily note to view
          </div>
        )}
      </div>
    </div>
  )
}
