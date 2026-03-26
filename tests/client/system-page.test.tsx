import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ServicesGrid from '../../src/components/system/ServicesGrid'
import ServerVitals from '../../src/components/system/ServerVitals'
import UsageTracker from '../../src/components/system/UsageTracker'
import { getUsageTone } from '../../src/components/system/usageTone'
import type { ServiceInfo, VitalsResponse, UsageProfile } from '../../src/lib/types'

describe('System components', () => {
  it('renders service groups and disables forbidden actions', () => {
    const services: ServiceInfo[] = [
      {
        name: 'dashboard-server',
        display_name: 'Dashboard Server',
        group: 'Core',
        status: 'active',
        uptime: '2h',
        memory_mb: 128,
        forbidden: false,
      },
      {
        name: 'openclaw-gateway',
        display_name: 'OpenClaw Gateway',
        group: 'Core',
        status: 'inactive',
        uptime: 'stopped',
        memory_mb: 0,
        forbidden: true,
      },
    ]

    render(
      <ServicesGrid
        services={services}
        loading={false}
        onAction={vi.fn()}
      />,
    )

    expect(screen.getByText('Core')).toBeInTheDocument()
    expect(screen.getByText('OpenClaw Gateway')).toBeInTheDocument()
    // Forbidden services no longer render action buttons at all (not disabled — absent)
    expect(screen.queryByRole('button', { name: /restart openclaw gateway/i })).toBeNull()
    // Active non-forbidden service should have contextual buttons (restart, stop)
    expect(screen.getByRole('button', { name: /restart dashboard server/i })).toBeInTheDocument()
  })

  it('renders a 16-cell cpu heatmap', () => {
    const vitals: VitalsResponse = {
      cpu: { overall: 30, temperature: 62, per_core: new Array(16).fill(20) },
      memory: { used_mb: 8192, total_mb: 16384, top_processes: [] },
      disk: { used_mb: 200000, total_mb: 400000, key_dirs: [] },
      load: { one: 0.5, five: 0.4, fifteen: 0.3 },
      tailscale_ip: '100.64.0.1',
      uptime_seconds: 3600,
    }

    render(<ServerVitals vitals={vitals} loading={false} />)

    expect(screen.getAllByTestId('cpu-core-cell')).toHaveLength(16)
  })

  it('uses amber usage tone when profile usage exceeds sixty percent', () => {
    expect(getUsageTone(0.61)).toBe('amber')
    expect(getUsageTone(0.9)).toBe('red')
    expect(getUsageTone(0.25)).toBe('green')
  })

  it('renders usage rows and switch action', () => {
    const profiles: UsageProfile[] = [
      {
        id: 'claude-max',
        label: 'Claude yura/Max',
        profile: 'yura',
        model: 'claude-3-7-sonnet',
        tokens_used: 70,
        tokens_limit: 100,
        requests_used: 7,
        requests_limit: 10,
        reset_at: '2026-03-21T09:00:00.000Z',
        active: true,
      },
    ]

    render(
      <UsageTracker
        data={{ cached: true, stale: false, profiles }}
        loading={false}
        onSwitchProfile={vi.fn()}
      />,
    )

    expect(screen.getByText('Claude yura/Max')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /switch profile/i })).toBeInTheDocument()
  })
})
