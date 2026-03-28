import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import ConfirmDialog from '../../src/components/ui/ConfirmDialog'

describe('ConfirmDialog', () => {
  afterEach(cleanup)

  const baseProps = {
    open: true,
    title: 'Confirm Action',
    message: 'Are you sure?',
    confirmLabel: 'Confirm',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...baseProps} />)
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ConfirmDialog {...baseProps} open={false} />)
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument()
  })

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('confirm button enabled when no confirmText required', () => {
    const onConfirm = vi.fn()
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />)
    const btn = screen.getByText('Confirm')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('confirm button disabled until confirmText matches', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog {...baseProps} onConfirm={onConfirm} confirmText="archimedes" />
    )
    const btn = screen.getByRole('button', { name: /confirm/i })
    expect(btn).toBeDisabled()

    const input = screen.getByPlaceholderText('archimedes')
    fireEvent.change(input, { target: { value: 'archimed' } })
    expect(btn).toBeDisabled()

    fireEvent.change(input, { target: { value: 'archimedes' } })
    expect(btn).not.toBeDisabled()

    fireEvent.click(btn)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when backdrop clicked', () => {
    const onCancel = vi.fn()
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('confirm-dialog-backdrop'))
    expect(onCancel).toHaveBeenCalled()
  })
})
