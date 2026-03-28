interface ConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'warning' | 'danger'
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
}: ConfirmDialogProps) {
  const confirmColor =
    variant === 'danger'
      ? 'bg-red hover:bg-red/80 text-text-primary'
      : 'bg-amber hover:bg-amber/80 text-text-inverse'

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onCancel}
        data-testid="confirm-overlay"
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[380px] max-w-[90vw] bg-bg-elevated border border-border-subtle rounded-lg shadow-panel animate-fade-in">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-subtle">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary rounded-sm transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${confirmColor}`}
            data-testid="confirm-button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  )
}
