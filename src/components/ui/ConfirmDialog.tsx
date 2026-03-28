import { useState } from 'react'
import type { ReactNode } from 'react'

interface ConfirmDialogProps {
  open?: boolean
  title: string
  message: string | ReactNode
  /** If set, user must type this string to enable the Confirm button */
  confirmText?: string
  /** Label shown on the Confirm button (default: "Confirm") */
  confirmLabel?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'warning' | 'danger'
}

export default function ConfirmDialog({
  open = true,
  title,
  message,
  confirmText,
  confirmLabel = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'warning',
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')

  if (!open) return null

  const requiresTyping = Boolean(confirmText)
  const isConfirmEnabled = !requiresTyping || typed === confirmText

  const confirmColor =
    variant === 'danger'
      ? 'bg-red hover:bg-red/80 disabled:opacity-40 text-text-primary'
      : 'bg-amber hover:bg-amber/80 disabled:opacity-40 text-text-inverse'

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onCancel}
        data-testid="confirm-dialog-backdrop"
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[380px] max-w-[90vw] bg-bg-elevated border border-border-subtle rounded-lg shadow-panel animate-fade-in">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        <div className="px-4 py-4">
          {typeof message === 'string' ? (
            <p className="text-sm text-text-secondary leading-relaxed">{message}</p>
          ) : (
            message
          )}
          {requiresTyping && (
            <div className="mt-3">
              <p className="text-[11px] text-text-tertiary mb-1.5">
                Type <code className="font-mono text-text-secondary">{confirmText}</code> to confirm:
              </p>
              <input
                type="text"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                placeholder={confirmText}
                className="w-full px-2.5 py-1.5 text-sm bg-bg-surface border border-border-subtle rounded text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-accent-amber/50"
                autoFocus
              />
            </div>
          )}
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
            disabled={!isConfirmEnabled}
            className={`px-3 py-1.5 text-sm font-medium rounded-sm transition-colors ${confirmColor}`}
            data-testid="confirm-button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
