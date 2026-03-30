import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { QuickSearch } from '../../src/components/pipeline/QuickSearch'
import type { Task } from '../../src/lib/types'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'tsk_001',
    state: 'EXECUTION',
    owner: 'archimedes',
    route: 'build_route',
    title: 'Default task',
    age: 10,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    ...overrides,
  }
}

const sampleTasks: Task[] = [
  makeTask({ id: 'tsk_001', title: 'Add quick search' }),
  makeTask({ id: 'tsk_002', title: 'Fix pipeline bug' }),
  makeTask({ id: 'tsk_003', title: 'Update dashboard layout' }),
  makeTask({ id: 'tsk_010', title: 'Search improvements', state: 'DONE' }),
]

describe('QuickSearch', () => {
  afterEach(cleanup)

  const baseProps = {
    tasks: sampleTasks,
    onSelect: vi.fn(),
  }

  it('does not render when closed', () => {
    render(<QuickSearch {...baseProps} open={false} onClose={vi.fn()} />)
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument()
  })

  it('renders search input when open', () => {
    render(<QuickSearch {...baseProps} open={true} onClose={vi.fn()} />)
    expect(screen.getByPlaceholderText(/search tasks/i)).toBeInTheDocument()
  })

  it('shows all tasks initially (up to 10)', () => {
    render(<QuickSearch {...baseProps} open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Add quick search')).toBeInTheDocument()
    expect(screen.getByText('Fix pipeline bug')).toBeInTheDocument()
    expect(screen.getByText('Update dashboard layout')).toBeInTheDocument()
    expect(screen.getByText('Search improvements')).toBeInTheDocument()
  })

  it('filters by title (partial match, case-insensitive)', () => {
    render(<QuickSearch {...baseProps} open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'search' },
    })
    const results = screen.getAllByTestId('quick-search-result')
    expect(results).toHaveLength(2)
    expect(screen.queryByText('Fix pipeline bug')).not.toBeInTheDocument()
  })

  it('filters by task ID (prefix match)', () => {
    render(<QuickSearch {...baseProps} open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'tsk_01' },
    })
    expect(screen.getByText('Search improvements')).toBeInTheDocument()
    expect(screen.queryByText('Fix pipeline bug')).not.toBeInTheDocument()
  })

  it('limits results to 10', () => {
    const manyTasks = Array.from({ length: 15 }, (_, i) =>
      makeTask({ id: `tsk_${String(i).padStart(3, '0')}`, title: `Task ${i}` })
    )
    render(
      <QuickSearch tasks={manyTasks} open={true} onSelect={vi.fn()} onClose={vi.fn()} />
    )
    const items = screen.getAllByTestId('quick-search-result')
    expect(items.length).toBe(10)
  })

  it('calls onSelect when a result is clicked', () => {
    const onSelect = vi.fn()
    render(<QuickSearch {...baseProps} open={true} onSelect={onSelect} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Fix pipeline bug'))
    expect(onSelect).toHaveBeenCalledWith(sampleTasks[1])
  })

  it('calls onSelect when Enter is pressed on highlighted result', () => {
    const onSelect = vi.fn()
    render(<QuickSearch {...baseProps} open={true} onSelect={onSelect} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText(/search tasks/i)
    // First item is highlighted by default, press Enter
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(sampleTasks[0])
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<QuickSearch {...baseProps} open={true} onClose={onClose} />)
    fireEvent.keyDown(screen.getByPlaceholderText(/search tasks/i), {
      key: 'Escape',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<QuickSearch {...baseProps} open={true} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('quick-search-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('navigates results with arrow keys', () => {
    const onSelect = vi.fn()
    render(<QuickSearch {...baseProps} open={true} onSelect={onSelect} onClose={vi.fn()} />)
    const input = screen.getByPlaceholderText(/search tasks/i)

    // Default: first item highlighted
    const items = screen.getAllByTestId('quick-search-result')
    expect(items[0]).toHaveAttribute('data-active', 'true')

    // Arrow down → second item
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(items[1]).toHaveAttribute('data-active', 'true')
    expect(items[0]).toHaveAttribute('data-active', 'false')

    // Arrow up → back to first
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(items[0]).toHaveAttribute('data-active', 'true')
  })

  it('includes DONE tasks in search results', () => {
    render(<QuickSearch {...baseProps} open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'improvements' },
    })
    const results = screen.getAllByTestId('quick-search-result')
    expect(results).toHaveLength(1)
    // The DONE task (tsk_010) should be in results
    expect(screen.getByText('tsk_010')).toBeInTheDocument()
  })

  it('highlights matching text in results', () => {
    render(<QuickSearch {...baseProps} open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'quick' },
    })
    const mark = screen.getByTestId('quick-search-highlight')
    expect(mark.textContent).toBe('quick')
    expect(mark.tagName).toBe('MARK')
  })

  it('shows empty state when no results match', () => {
    render(<QuickSearch {...baseProps} open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search tasks/i), {
      target: { value: 'nonexistent_xyz' },
    })
    expect(screen.getByText(/no tasks found/i)).toBeInTheDocument()
  })
})
