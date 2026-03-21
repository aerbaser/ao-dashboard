import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildTaskCounts,
  countAliveAgents,
  createEmptyStatus,
  toGlobalStatus,
} from './status.js'

test('buildTaskCounts separates active, blocked, stuck, and failed tasks', () => {
  const counts = buildTaskCounts([
    { state: 'EXECUTION' },
    { state: 'BLOCKED' },
    { state: 'STUCK' },
    { state: 'FAILED' },
    { state: 'DONE' },
  ])

  assert.deepEqual(counts, {
    active_tasks: 3,
    blocked_tasks: 1,
    stuck_tasks: 1,
    failed_tasks: 1,
  })
})

test('countAliveAgents uses a five-minute heartbeat window', () => {
  const alive = countAliveAgents([
    { age: 0 },
    { age: 4 },
    { age: 5 },
    { age: 9 },
  ])

  assert.equal(alive, 2)
})

test('toGlobalStatus always returns the authoritative 12-field payload', () => {
  const status = toGlobalStatus({
    dashboard: {
      tasks: [{ state: 'FAILED' }, { state: 'BLOCKED' }, { state: 'EXECUTION' }],
      agents: [{ age: 1 }, { age: 6 }],
    },
    services: [
      { name: 'openclaw-gateway', active: true },
      { name: 'mailbox-pump', active: false },
    ],
    vitals: { cpu_percent: 12, cpu_temp: 64 },
    usage: { claude_usage_percent: 55, codex_usage_percent: 8 },
    agentsTotal: 9,
  })

  assert.deepEqual(status, {
    gateway_up: true,
    agents_alive: 1,
    agents_total: 9,
    active_tasks: 2,
    blocked_tasks: 1,
    stuck_tasks: 0,
    failed_tasks: 1,
    failed_services: 1,
    cpu_percent: 12,
    cpu_temp: 64,
    claude_usage_percent: 55,
    codex_usage_percent: 8,
  })
})

test('createEmptyStatus fills every field with non-null defaults', () => {
  assert.deepEqual(createEmptyStatus(), {
    gateway_up: false,
    agents_alive: 0,
    agents_total: 9,
    active_tasks: 0,
    blocked_tasks: 0,
    stuck_tasks: 0,
    failed_tasks: 0,
    failed_services: 0,
    cpu_percent: 0,
    cpu_temp: 0,
    claude_usage_percent: 0,
    codex_usage_percent: 0,
  })
})
