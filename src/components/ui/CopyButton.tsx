import { useState } from 'react'

interface CopyButtonProps {
  text: string
  className?: string
}

export default function CopyButton({ text, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className={`opacity-0 group-hover:opacity-100 text-text-disabled hover:text-text-secondary transition-opacity text-xs ${className}`}
      title="Copy to clipboard"
    >
      {copied ? '✓' : '⎘'}
    </button>
  )
}
