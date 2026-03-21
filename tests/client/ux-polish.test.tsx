import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToastProvider, useToast } from '../../src/hooks/useToast'
import ToastStack from '../../src/components/layout/Toast'
import Skeleton from '../../src/components/ui/Skeleton'
import EmptyState from '../../src/components/ui/EmptyState'
import ErrorBoundary from '../../src/components/layout/ErrorBoundary'
import { useApi } from '../../src/hooks/useApi'

// Helper: render toast system
function ToastHarness({ action }: { action: (ctx: ReturnType<typeof useToast>) => void }) {
  const toast = useToast()
  return (
    <button onClick={() => action(toast)}>trigger</button>
  )
}

function renderWithToast(action: (ctx: ReturnType<typeof useToast>) => void) {
  return render(
    <ToastProvider>
      <ToastHarness action={action} />
      <ToastStack />
    </ToastProvider>
  )
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    act(() => { vi.runAllTimers() })
    cleanup()
    vi.useRealTimers()
  })

  it('caps at 5 toasts when 6 are pushed', () => {
    renderWithToast((toast) => {
      for (let i = 0; i < 6; i++) {
        toast.push(`Message ${i}`, 'info')
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'trigger' }))
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(5)
  })

  it('error toast does not auto-dismiss', () => {
    renderWithToast((toast) => toast.push('Error!', 'error'))
    fireEvent.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(10000) })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('success toast auto-dismisses after 5000ms', () => {
    renderWithToast((toast) => toast.push('Done!', 'success'))
    fireEvent.click(screen.getByRole('button', { name: 'trigger' }))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(5001) })
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })
})

describe('Skeleton', () => {
  it('renders with animate-skeleton class', () => {
    const { container } = render(<Skeleton className="h-4" />)
    const el = container.firstChild as HTMLElement
    expect(el.className).toContain('animate-skeleton')
  })

  it('renders multiple lines when lines prop provided', () => {
    const { container } = render(<Skeleton lines={3} height="16px" />)
    // The wrapper div contains 3 skeleton divs
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.children).toHaveLength(3)
  })
})

describe('EmptyState', () => {
  it('renders icon and title', () => {
    render(<EmptyState icon="○" title="No items" />)
    expect(screen.getByText('○')).toBeTruthy()
    expect(screen.getByText('No items')).toBeTruthy()
  })

  it('renders action button and calls onClick', () => {
    const onClick = vi.fn()
    render(<EmptyState icon="○" title="No items" action={{ label: 'Add one', onClick }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('ErrorBoundary', () => {
  it('catches render error and shows retry button', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Bomb() {
      throw new Error('test crash')
    }
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    consoleSpy.mockRestore()
  })
})

describe('useApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('loading=true on first fetch, false after data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    }))

    let capturedResult: { loading: boolean; data: unknown } | null = null

    function ApiConsumer() {
      const result = useApi<{ items: unknown[] }>('/api/test')
      capturedResult = { loading: result.loading, data: result.data }
      return <div data-testid="status">{result.loading ? 'loading' : 'done'}</div>
    }

    const { findByText } = render(
      <ToastProvider>
        <ApiConsumer />
      </ToastProvider>
    )
    // Initially loading
    expect(screen.getByTestId('status').textContent).toBe('loading')
    // After fetch resolves
    await findByText('done')
    expect(capturedResult?.loading).toBe(false)
    expect(capturedResult?.data).toEqual({ items: [] })
  })
})
