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

interface ToastContextValue {
  toasts: Toast[]
  push: (message: string, variant: ToastVariant, options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>) => void
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
    message: string,
    variant: ToastVariant,
    options?: Partial<Omit<Toast, 'id' | 'message' | 'variant'>>
  ) => {
    const id = `${Date.now()}-${Math.random()}`
    const toast: Toast = { id, message, variant, dismissible: true, ...options }
    setToasts((prev) => {
      const next = [...prev, toast]
      if (next.length > MAX_TOASTS) {
        const removed = next.shift()!
        const oldTimer = timers.current.get(removed.id)
        if (oldTimer) { clearTimeout(oldTimer); timers.current.delete(removed.id) }
      }
      return next
    })
    const delay = AUTO_DISMISS_MS[variant]
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

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
