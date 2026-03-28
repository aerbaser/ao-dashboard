import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetchPipelineItems from api
vi.mock('../../src/lib/api', async () => {
  const actual = await vi.importActual('../../src/lib/api')
  return {
    ...actual,
    fetchPipelineItems: vi.fn(),
  }
})

// Mock usePolling to return controlled data
vi.mock('../../src/hooks/usePolling', () => ({
  usePolling: vi.fn(),
}))

import Pipeline from '../../src/pages/Pipeline'
import { usePolling } from '../../src/hooks/usePolling'

const mockItems = [
  { id: '1', title: 'Blocked task', description: null, status: 'blocked', checkbox: '!', section: 'blocked' },
  { id: '2', title: 'In progress task', description: 'doing it', status: 'pending', checkbox: ' ', section: 'in_progress' },
  { id: '3', title: 'Done task', description: null, status: 'completed', checkbox: 'x', section: 'done' },
]

describe('Pipeline page', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePolling).mockReturnValue({
      data: mockItems,
      loading: false,
      error: null,
      refetch: vi.fn(),
      refresh: vi.fn(),
    })
  })

  it('renders pipeline columns', () => {
    render(<Pipeline />)

    expect(screen.getByText(/🔴 Blocked/)).toBeInTheDocument()
    expect(screen.getByText(/🟡 In Progress/)).toBeInTheDocument()
    expect(screen.getByText(/❓ Open Questions/)).toBeInTheDocument()
    expect(screen.getByText(/✅ Done/)).toBeInTheDocument()
  })

  it('shows items in correct columns', () => {
    render(<Pipeline />)

    expect(screen.getByText('Blocked task')).toBeInTheDocument()
    expect(screen.getByText('In progress task')).toBeInTheDocument()
    expect(screen.getByText('Done task')).toBeInTheDocument()
  })

  it('shows freshness indicator', () => {
    render(<Pipeline />)

    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('hideEmpty toggle hides empty columns', () => {
    render(<Pipeline />)

    // Before toggling: Open Questions column should be present (no items, but visible)
    expect(screen.getByText(/❓ Open Questions/)).toBeInTheDocument()

    // Check the "Hide empty" checkbox
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    // Open Questions column has no items and should be hidden
    expect(screen.queryByText(/❓ Open Questions/)).not.toBeInTheDocument()

    // Columns with items should still be visible
    expect(screen.getByText(/🔴 Blocked/)).toBeInTheDocument()
    expect(screen.getByText(/🟡 In Progress/)).toBeInTheDocument()
    expect(screen.getByText(/✅ Done/)).toBeInTheDocument()
  })
})
