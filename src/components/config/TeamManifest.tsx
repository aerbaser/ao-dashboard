import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function TeamManifest() {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/config/team-manifest')
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setContent(data.content)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-text-tertiary text-sm animate-pulse">Loading team manifest...</div>
  }

  if (error) {
    return <div className="text-ao-red text-sm">Error: {error}</div>
  }

  if (!content) {
    return <div className="text-text-tertiary text-sm">No team manifest found.</div>
  }

  return (
    <div className="max-w-4xl">
      <p className="text-text-tertiary text-xs mb-4 font-mono">
        ~/.openclaw/shared-memory/team-manifest.md
      </p>
      <div className="prose">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  )
}
