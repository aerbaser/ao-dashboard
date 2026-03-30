import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { MultiSelect } from '../../src/components/ui/MultiSelect'

describe('MultiSelect', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows placeholder when nothing selected', () => {
    render(
      <MultiSelect options={['a', 'b']} value={[]} onChange={vi.fn()} placeholder="All owners" />
    )
    expect(screen.getByTestId('multi-select-trigger')).toHaveTextContent('All owners')
  })

  it('shows single value when one selected', () => {
    render(
      <MultiSelect options={['a', 'b']} value={['a']} onChange={vi.fn()} placeholder="All owners" />
    )
    expect(screen.getByTestId('multi-select-trigger')).toHaveTextContent('a')
  })

  it('shows count when multiple selected', () => {
    render(
      <MultiSelect options={['a', 'b', 'c']} value={['a', 'b']} onChange={vi.fn()} placeholder="All owners" />
    )
    expect(screen.getByTestId('multi-select-trigger')).toHaveTextContent('2 selected')
  })

  it('opens dropdown and toggles selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <MultiSelect options={['archimedes', 'sokrat', 'platon']} value={[]} onChange={onChange} placeholder="All owners" />
    )

    await user.click(screen.getByTestId('multi-select-trigger'))
    // Dropdown should be open with checkboxes
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)

    // Click first option
    await user.click(checkboxes[0])
    expect(onChange).toHaveBeenCalledWith(['archimedes'])
  })

  it('removes item when unchecking selected option', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <MultiSelect options={['archimedes', 'sokrat']} value={['archimedes']} onChange={onChange} placeholder="All owners" />
    )

    await user.click(screen.getByTestId('multi-select-trigger'))
    const checkboxes = screen.getAllByRole('checkbox')
    // First checkbox should be checked
    expect(checkboxes[0]).toBeChecked()

    await user.click(checkboxes[0])
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('supports selecting multiple options', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <MultiSelect options={['archimedes', 'sokrat']} value={['archimedes']} onChange={onChange} placeholder="All owners" />
    )

    await user.click(screen.getByTestId('multi-select-trigger'))
    const checkboxes = screen.getAllByRole('checkbox')
    // Click second option to add to selection
    await user.click(checkboxes[1])
    expect(onChange).toHaveBeenCalledWith(['archimedes', 'sokrat'])
  })
})
