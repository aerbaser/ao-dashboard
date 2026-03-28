import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ArtifactPanelProps {
  markdown: string
}

export default function ArtifactPanel({ markdown }: ArtifactPanelProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-2 border border-border-subtle rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-bg-elevated hover:bg-bg-hover transition-colors text-xs text-text-secondary"
      >
        <span className="font-medium text-emerald">Artifact</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 py-2 prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-text-secondary
          [&_h1]:text-sm [&_h1]:text-text-primary [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1
          [&_h2]:text-xs [&_h2]:text-text-primary [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1
          [&_h3]:text-xs [&_h3]:text-text-primary [&_h3]:font-medium [&_h3]:mt-2 [&_h3]:mb-1
          [&_code]:text-amber [&_code]:bg-bg-elevated [&_code]:px-1 [&_code]:rounded-sm
          [&_pre]:bg-bg-base [&_pre]:rounded-md [&_pre]:p-2 [&_pre]:overflow-x-auto
          [&_a]:text-blue [&_a]:underline
          [&_ul]:pl-4 [&_ol]:pl-4
          [&_li]:marker:text-text-tertiary
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {markdown}
          </ReactMarkdown>
        </div>
      )}
    </div>
  )
}
