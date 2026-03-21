import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="m-4 p-4 rounded-lg bg-red-subtle border border-red-dim text-text-primary">
          <p className="text-sm font-medium mb-2">Something went wrong</p>
          <p className="text-xs text-text-secondary mb-4 font-mono">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-xs rounded-sm border border-border-default text-text-secondary hover:bg-bg-hover transition-colors"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface InlineErrorCardProps {
  message: string
  onRetry?: () => void
}

export function InlineErrorCard({ message, onRetry }: InlineErrorCardProps) {
  return (
    <div className="p-3 rounded-md bg-red-subtle border border-red-dim text-text-primary text-sm">
      <span className="text-xs font-mono">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-3 text-xs text-accent-amber hover:underline">
          Retry
        </button>
      )}
    </div>
  )
}
