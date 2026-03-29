import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import TopBar from '../../src/components/layout/TopBar'
import type { GlobalStatus } from '../../src/lib/types'

function makeStatus(overrides: Partial<GlobalStatus> = {}): GlobalStatus {
  return {
    gateway_up: true,
    agents_alive: 2,
    agents_total: 9,
    active_tasks: 1,
    blocked_tasks: 0,
    stuck_tasks: 0,
    failed_services: 0,
    cpu_percent: 25,
    cpu_temp: 55,
    claude_usage_percent: 40,
    codex_usage_percent: 20,
    awaiting_owner_count: 0,
    awaiting_owner_overdue: false,
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function renderTopBar(status: GlobalStatus | null) {
  return render(
    <MemoryRouter>
      <TopBar status={status} />
    </MemoryRouter>,
  )
}

describe('TopBar — AWAITING_OWNER badge', () => {
  afterEach(cleanup)

  it('shows badge when awaiting_owner_count > 0', () => {
    renderTopBar(makeStatus({ awaiting_owner_count: 3 }))
    const pill = screen.getByTestId('awaiting-owner-pill')
    expect(pill).toBeInTheDocument()
    expect(pill.textContent).toContain('⏳')
    expect(pill.textContent).toContain('3')
  })

  it('hides badge when awaiting_owner_count is 0', () => {
    renderTopBar(makeStatus({ awaiting_owner_count: 0 }))
    expect(screen.queryByTestId('awaiting-owner-pill')).not.toBeInTheDocument()
  })

  it('hides badge when status is null', () => {
    renderTopBar(null)
    expect(screen.queryByTestId('awaiting-owner-pill')).not.toBeInTheDocument()
  })

  it('shows pulse dot when awaiting_owner_overdue is true', () => {
    renderTopBar(makeStatus({ awaiting_owner_count: 2, awaiting_owner_overdue: true }))
    const pulse = screen.getByTestId('awaiting-owner-pulse')
    expect(pulse).toBeInTheDocument()
    expect(pulse.className).toContain('animate-pulse-critical')
    expect(pulse.className).toContain('bg-red')
  })

  it('does not show pulse dot when awaiting_owner_overdue is false', () => {
    renderTopBar(makeStatus({ awaiting_owner_count: 2, awaiting_owner_overdue: false }))
    expect(screen.getByTestId('awaiting-owner-pill')).toBeInTheDocument()
    expect(screen.queryByTestId('awaiting-owner-pulse')).not.toBeInTheDocument()
  })

  it('displays correct count value', () => {
    renderTopBar(makeStatus({ awaiting_owner_count: 7 }))
    const pill = screen.getByTestId('awaiting-owner-pill')
    expect(pill.textContent).toContain('7')
  })
})
