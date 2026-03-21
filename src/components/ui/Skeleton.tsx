import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  width?: string
  height?: string
  lines?: number
}

export default function Skeleton({ className = '', width, height, lines }: SkeletonProps) {
  const style: CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  const baseClass = `animate-skeleton rounded bg-gradient-to-r from-bg-surface via-bg-elevated to-bg-surface bg-[length:200%_100%] ${className}`

  if (lines && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} style={style} className={baseClass} />
        ))}
      </div>
    )
  }

  return <div style={style} className={baseClass} />
}
