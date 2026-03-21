interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-bg-surface border border-border-subtle rounded-lg text-center">
      <span className="text-2xl mb-3 text-text-tertiary">{icon}</span>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      {description && <p className="text-xs text-text-tertiary mt-1">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-3 py-1.5 text-xs rounded-sm border border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
