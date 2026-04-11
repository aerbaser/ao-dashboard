import { describe, it, expect } from 'vitest'
import {
  PIPELINE_STATES,
  LEGACY_FLOW_STATES,
  type GlobalStatus,
} from '../../src/lib/types'

describe('v2 Phase 1 — AWAITING_OWNER position', () => {
  it('AWAITING_OWNER sits between EXECUTION and REVIEW_PENDING in legacy flow', () => {
    const idx = LEGACY_FLOW_STATES.indexOf('AWAITING_OWNER')
    expect(idx).toBeGreaterThan(-1)
    expect(LEGACY_FLOW_STATES[idx - 1]).toBe('EXECUTION')
    expect(LEGACY_FLOW_STATES[idx + 1]).toBe('REVIEW_PENDING')
  })

  it('AWAITING_OWNER is present in PIPELINE_STATES', () => {
    expect(PIPELINE_STATES).toContain('AWAITING_OWNER')
  })

  it('GlobalStatus includes awaiting_owner_count and awaiting_owner_overdue', () => {
    const status: GlobalStatus = {
      gateway_up: true,
      agents_alive: 1,
      agents_total: 2,
      active_tasks: 0,
      blocked_tasks: 0,
      stuck_tasks: 0,
      failed_services: 0,
      cpu_percent: null,
      cpu_temp: null,
      claude_usage_percent: null,
      codex_usage_percent: null,
      awaiting_owner_count: 3,
      awaiting_owner_overdue: true,
      timestamp: new Date().toISOString(),
      ideas_actionable: 0,
    }
    expect(status.awaiting_owner_count).toBe(3)
    expect(status.awaiting_owner_overdue).toBe(true)
  })
})
