import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { updateAgentSkills, fetchAllSkills } from '../../lib/api'
import type { SkillsData } from '../../lib/api'
import type { ToastPayload } from '../../hooks/useToast'

interface SkillsManagerProps {
  agentId: string
  initialSkills: string[]
  onToast: (toast: ToastPayload) => void
}

export default function SkillsManager({ agentId, initialSkills, onToast }: SkillsManagerProps) {
  const toastRef = useRef(onToast)
  toastRef.current = onToast

  const [allSkills, setAllSkills] = useState<SkillsData | null>(null)
  const [activeSkills, setActiveSkills] = useState<string[]>(initialSkills)
  const [pendingSkills, setPendingSkills] = useState<Set<string>>(new Set(initialSkills))
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const skillsData = await fetchAllSkills()
      setAllSkills(skillsData)
    } catch {
      toastRef.current({ message: 'Failed to load skills', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Derive all unique skill names from the global skills data
  const allSkillNames = useMemo(() => {
    if (!allSkills) return []
    const names = new Set<string>()
    for (const skillList of Object.values(allSkills)) {
      for (const skill of skillList) {
        names.add(skill.name)
      }
    }
    return [...names].sort()
  }, [allSkills])

  // Skills currently toggled on in the pending set
  const pendingArray = useMemo(
    () => [...pendingSkills].sort(),
    [pendingSkills],
  )

  // Compute changes from original
  const changes = useMemo(() => {
    const activeSet = new Set(activeSkills)
    const added = pendingArray.filter(s => !activeSet.has(s))
    const removed = activeSkills.filter(s => !pendingSkills.has(s))
    return { added, removed }
  }, [activeSkills, pendingSkills, pendingArray])

  const hasChanges = changes.added.length > 0 || changes.removed.length > 0

  // Skills not currently in pending set (for the Add dropdown)
  const unassignedSkills = useMemo(() => {
    return allSkillNames.filter(s => !pendingSkills.has(s))
  }, [allSkillNames, pendingSkills])

  const toggleSkill = (name: string) => {
    setPendingSkills(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        // Don't allow removing the last skill
        if (next.size <= 1) return prev
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const addSkill = (name: string) => {
    setPendingSkills(prev => {
      const next = new Set(prev)
      next.add(name)
      return next
    })
    setDropdownOpen(false)
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      const result = await updateAgentSkills(agentId, [...pendingSkills])
      if (result.ok) {
        setActiveSkills(result.skills)
        setPendingSkills(new Set(result.skills))
        onToast({ message: 'Skills updated. Restart required.', variant: 'success' })
      } else {
        onToast({ message: `Update failed: ${result.error}`, variant: 'error' })
      }
    } catch {
      onToast({ message: 'Failed to update skills', variant: 'error' })
    } finally {
      setApplying(false)
    }
  }

  const handleDiscard = () => {
    setPendingSkills(new Set(activeSkills))
  }

  if (loading) {
    return <div className="text-[11px] text-text-tertiary py-4 text-center">Loading skills...</div>
  }

  return (
    <div className="space-y-3">
      {/* Change summary + Apply bar */}
      {hasChanges && (
        <div className="bg-bg-active border border-accent-amber/30 rounded px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-text-secondary flex-1 min-w-0">
            {changes.added.map(s => (
              <span key={s} className="text-emerald font-mono mr-1">+{s}</span>
            ))}
            {changes.removed.map(s => (
              <span key={s} className="text-red font-mono mr-1">-{s}</span>
            ))}
          </span>
          <button
            onClick={handleDiscard}
            className="px-2 py-1 rounded text-[11px] border border-border-subtle text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-3 py-1 rounded text-[11px] font-semibold bg-accent-amber text-text-inverse hover:bg-accent-amber/90 disabled:opacity-40 transition-colors"
          >
            {applying ? 'Applying...' : 'Apply'}
          </button>
        </div>
      )}

      {/* Skills grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {pendingArray.map(name => (
          <label
            key={name}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover transition-colors cursor-pointer group"
          >
            <input
              type="checkbox"
              checked
              onChange={() => toggleSkill(name)}
              className="accent-accent-amber w-3.5 h-3.5 rounded-sm shrink-0"
            />
            <span className="text-[12px] font-mono text-text-secondary group-hover:text-text-primary truncate">
              {name}
            </span>
          </label>
        ))}
      </div>

      {/* Add Skill dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(prev => !prev)}
          className="flex items-center gap-1 px-2 py-1.5 rounded text-[11px] text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
        >
          <span>+</span>
          <span>Add Skill</span>
          <svg
            className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M4 6l4 4 4-4z" />
          </svg>
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
            <div className="absolute left-0 bottom-full mb-1 w-64 max-h-48 overflow-y-auto bg-bg-elevated border border-border-subtle rounded shadow-lg z-20 scrollbar-thin">
              {unassignedSkills.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-text-tertiary">
                  All skills assigned
                </div>
              ) : (
                unassignedSkills.map(name => (
                  <button
                    key={name}
                    onClick={() => addSkill(name)}
                    className="block w-full text-left px-3 py-1.5 text-[12px] font-mono text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                  >
                    {name}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
