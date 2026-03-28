import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import type { ReactNode } from 'react'
import { ToastProvider, useToast } from '../../src/hooks/useToast'

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}

describe('useToast', () => {
  it('deduplicates consecutive identical toasts', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.push({ message: 'Failed to load skills', variant: 'error' })
      result.current.push({ message: 'Failed to load skills', variant: 'error' })
      result.current.push({ message: 'Failed to load skills', variant: 'error' })
    })

    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].message).toBe('Failed to load skills')
  })

  it('allows distinct messages through', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.push({ message: 'Error A', variant: 'error' })
      result.current.push({ message: 'Error B', variant: 'error' })
    })

    expect(result.current.toasts).toHaveLength(2)
  })

  it('allows same message with different variant', () => {
    const { result } = renderHook(() => useToast(), { wrapper })

    act(() => {
      result.current.push({ message: 'Done', variant: 'success' })
      result.current.push({ message: 'Done', variant: 'info' })
    })

    expect(result.current.toasts).toHaveLength(2)
  })
})
