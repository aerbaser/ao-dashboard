import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Skill {
  name: string
  path: string
  size: number
  content: string
}

type SkillsData = Record<string, Skill[]>

export default function SkillsBrowser() {
  const [skills, setSkills] = useState<SkillsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set())
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setSkills(data)
          // Expand all agents by default
          setExpandedAgents(new Set(Object.keys(data)))
        }
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-text-tertiary text-sm animate-pulse">Loading skills...</div>
  }

  if (error) {
    return <div className="text-ao-red text-sm">Error: {error}</div>
  }

  if (!skills || Object.keys(skills).length === 0) {
    return <div className="text-text-tertiary text-sm">No skills found.</div>
  }

  const toggleAgent = (agent: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev)
      if (next.has(agent)) next.delete(agent)
      else next.add(agent)
      return next
    })
  }

  const lowerSearch = search.toLowerCase()
  const filteredSkills: SkillsData = {}
  for (const [agent, skillList] of Object.entries(skills)) {
    const filtered = skillList.filter(s =>
      s.name.toLowerCase().includes(lowerSearch)
    )
    if (filtered.length > 0) filteredSkills[agent] = filtered
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-160px)]">
      {/* Left: tree */}
      <div className="w-72 shrink-0 overflow-y-auto">
        {/* Search */}
        <input
          type="text"
          placeholder="Filter skills..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-bg-void border border-border-default rounded-sm px-3 py-1.5 text-sm font-mono text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-amber mb-3"
        />

        {Object.entries(filteredSkills).map(([agent, skillList]) => (
          <div key={agent} className="mb-2">
            <button
              onClick={() => toggleAgent(agent)}
              className="flex items-center gap-2 w-full text-left py-1"
            >
              <svg
                className={`w-3 h-3 text-text-tertiary transition-transform ${expandedAgents.has(agent) ? 'rotate-90' : ''}`}
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M6 4l4 4-4 4z" />
              </svg>
              <span className="text-sm font-semibold text-amber">{agent}</span>
              <span className="text-xs text-text-tertiary">{skillList.length}</span>
            </button>

            {expandedAgents.has(agent) && (
              <div className="ml-5 border-l border-border-subtle pl-2">
                {skillList.map(skill => (
                  <button
                    key={skill.path}
                    onClick={() => setSelectedSkill(skill)}
                    className={`block w-full text-left py-1 px-2 rounded-sm text-sm transition-colors ${
                      selectedSkill?.path === skill.path
                        ? 'bg-amber-subtle text-amber'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                  >
                    <div className="font-mono">{skill.name}</div>
                    <div className="text-xs text-text-tertiary">{formatSize(skill.size)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right: content */}
      <div className="flex-1 overflow-y-auto bg-bg-surface border border-border-subtle rounded-lg p-6">
        {selectedSkill ? (
          <>
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border-subtle">
              <h2 className="text-md font-semibold text-text-primary">{selectedSkill.name}</h2>
              <span className="text-xs text-text-tertiary font-mono">{formatSize(selectedSkill.size)}</span>
            </div>
            <p className="text-xs text-text-tertiary font-mono mb-4 break-all">{selectedSkill.path}</p>
            <div className="prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedSkill.content}</ReactMarkdown>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
            Select a skill to view its content
          </div>
        )}
      </div>
    </div>
  )
}
