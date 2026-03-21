import { useToast } from '../../hooks/useToast'
import type { Toast, ToastVariant } from '../../hooks/useToast'

const VARIANT_STYLES: Record<ToastVariant, { border: string; icon: string }> = {
  success: { border: 'border-l-4 border-emerald', icon: '✓' },
  warning: { border: 'border-l-4 border-amber',   icon: '⚠' },
  error:   { border: 'border-l-4 border-red',     icon: '✕' },
  info:    { border: 'border-l-4 border-blue',    icon: 'ℹ' },
}

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast()
  const { border, icon } = VARIANT_STYLES[toast.variant]
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 px-4 py-3 rounded-md shadow-lg text-text-primary text-sm bg-bg-elevated animate-slide-in-right ${border}`}
    >
      <span className="shrink-0 font-mono">{icon}</span>
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button onClick={toast.action.fn} className="text-xs text-accent-amber hover:underline shrink-0">
          {toast.action.label}
        </button>
      )}
      {toast.dismissible !== false && (
        <button onClick={() => dismiss(toast.id)} aria-label="Dismiss" className="shrink-0 text-text-tertiary hover:text-text-primary">
          ×
        </button>
      )}
    </div>
  )
}

export default function ToastStack() {
  const { toasts } = useToast()
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>
  )
}
