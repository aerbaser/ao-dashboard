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

function renderTopBar(status: GlobalStatus | null, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <TopBar status={status} />
    </MemoryRouter>,
  )
}

describe('TopBar — system metrics visibility', () => {
  afterEach(cleanup)

  it('does not render CPU pill on non-system routes', () => {
    renderTopBar(makeStatus(), '/')
    expect(screen.queryByTestId('cpu-pill')).not.toBeInTheDocument()
  })

  it('does not render usage bars on non-system routes', () => {
    renderTopBar(makeStatus(), '/ideas')
    expect(screen.queryByTestId('usage-bars')).not.toBeInTheDocument()
  })

  it('renders CPU pill on /system route', () => {
    renderTopBar(makeStatus(), '/system')
    expect(screen.getByTestId('cpu-pill')).toBeInTheDocument()
    expect(screen.getByTestId('cpu-pill').textContent).toContain('CPU')
    expect(screen.getByTestId('cpu-pill').textContent).toContain('25%')
  })

  it('renders usage bars on /system route', () => {
    renderTopBar(makeStatus(), '/system')
    expect(screen.getByTestId('usage-bars')).toBeInTheDocument()
    expect(screen.getByTestId('usage-bars').textContent).toContain('Claude')
    expect(screen.getByTestId('usage-bars').textContent).toContain('Codex')
  })

  it('always renders GW pill regardless of route', () => {
    renderTopBar(makeStatus(), '/')
    expect(screen.getByText('GW')).toBeInTheDocument()
  })

  it('always renders Agents pill regardless of route', () => {
    renderTopBar(makeStatus(), '/ideas')
    expect(screen.getByText('Agents')).toBeInTheDocument()
  })
})
