import { createContext, useContext, useState, useRef, useCallback } from 'react'
import type { ReactNode } from 'react'

export type ToastVariant = 'success' | 'warning' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  dismissible?: boolean
  action?: { label: string; fn: () => void }
}

export type ToastPayload = Omit<Toast, 'id'>
type ToastOptions = Partial<Omit<Toast, 'id' | 'message' | 'variant'>>

interface ToastContextValue {
  toasts: Toast[]
  push: {
    (toast: ToastPayload): void
    (message: string, variant: ToastVariant, options?: ToastOptions): void
  }
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS: Record<ToastVariant, number | null> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: null,
}
const MAX_TOASTS = 5

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t) { clearTimeout(t); timers.current.delete(id) }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((
    messageOrToast: string | ToastPayload,
    variant?: ToastVariant,
    options?: ToastOptions
  ) => {
    const id = `${Date.now()}-${Math.random()}`
    const payload = typeof messageOrToast === 'string'
      ? { message: messageOrToast, variant: variant!, ...options }
      : messageOrToast
    const toast: Toast = { id, dismissible: true, ...payload }
    setToasts((prev) => {
      const next = [...prev, toast]
      if (next.length > MAX_TOASTS) {
        const removed = next.shift()!
        const oldTimer = timers.current.get(removed.id)
        if (oldTimer) { clearTimeout(oldTimer); timers.current.delete(removed.id) }
      }
      return next
    })
    const delay = AUTO_DISMISS_MS[toast.variant]
    if (delay !== null) {
      const t = setTimeout(() => dismiss(id), delay)
      timers.current.set(id, t)
    }
  }, [dismiss])

  const dismissAll = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t))
    timers.current.clear()
    setToasts([])
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss, dismissAll }}>
      {children}
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
