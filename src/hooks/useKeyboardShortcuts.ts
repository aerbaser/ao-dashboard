import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export interface Shortcut {
  keys: string
  description: string
  action: () => void
}

export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const [showHelp, setShowHelp] = useState(false)
  const [pendingG, setPendingG] = useState(false)

  const shortcuts: Shortcut[] = [
    { keys: 'g p', description: 'Go to Pipeline', action: () => navigate('/') },
    { keys: 'g a', description: 'Go to Agents', action: () => navigate('/agents') },
    { keys: 'g s', description: 'Go to System', action: () => navigate('/system') },
    { keys: 'g l', description: 'Go to Logs', action: () => navigate('/logs') },
    { keys: 'g c', description: 'Go to Config', action: () => navigate('/config') },
    { keys: '?', description: 'Show shortcuts', action: () => setShowHelp(true) },
    { keys: 'Esc', description: 'Close panel / modal', action: () => setShowHelp(false) },
  ]

  const handleKey = useCallback((e: KeyboardEvent) => {
    // Ignore when typing in input/textarea/select
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    if (e.key === 'Escape') {
      setShowHelp(false)
      setPendingG(false)
      return
    }

    if (e.key === '?') {
      e.preventDefault()
      setShowHelp(prev => !prev)
      return
    }

    if (pendingG) {
      setPendingG(false)
      const map: Record<string, string> = { p: '/', a: '/agents', s: '/system', l: '/logs', c: '/config' }
      if (map[e.key]) {
        e.preventDefault()
        navigate(map[e.key])
      }
      return
    }

    if (e.key === 'g') {
      setPendingG(true)
      // Reset after 1s if no second key
      setTimeout(() => setPendingG(false), 1000)
      return
    }
  }, [pendingG, navigate])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  return { showHelp, setShowHelp, shortcuts }
}
