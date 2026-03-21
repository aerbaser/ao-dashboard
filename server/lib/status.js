import { execFile } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { promisify } from 'util'

import { readRateLimitSnapshot } from './rate-limits.js'

const execFileAsync = promisify(execFile)

const DEFAULT_AGENTS_TOTAL = 9
const ALIVE_WINDOW_MINUTES = 5
const DASHBOARD_SCRIPT = join(homedir(), 'clawd/scripts/ao-dashboard.js')
const SERVICE_CACHE_TTL_MS = 10_000
const VITALS_CACHE_TTL_MS = 10_000
const MONITORED_SERVICES = [
  'openclaw-gateway',
  'mailbox-pump',
  'stuck-detector',
  'decision-timeout-sweeper',
]

const TERMINAL_TASK_STATES = new Set(['DONE', 'FAILED', 'CANCELLED', 'SUPERSEDED'])

export function createEmptyStatus({ agentsTotal = DEFAULT_AGENTS_TOTAL } = {}) {
  return {
    gateway_up: false,
    agents_alive: 0,
    agents_total: agentsTotal,
    active_tasks: 0,
    blocked_tasks: 0,
    stuck_tasks: 0,
    failed_tasks: 0,
    failed_services: 0,
    cpu_percent: 0,
    cpu_temp: 0,
    claude_usage_percent: 0,
    codex_usage_percent: 0,
  }
}

export function buildTaskCounts(tasks = []) {
  return tasks.reduce((counts, task) => {
    const state = typeof task?.state === 'string' ? task.state.toUpperCase() : ''

    if (state && !TERMINAL_TASK_STATES.has(state)) {
      counts.active_tasks += 1
    }

    if (state === 'BLOCKED') {
      counts.blocked_tasks += 1
    }

    if (state === 'STUCK') {
      counts.stuck_tasks += 1
    }

    if (state === 'FAILED') {
      counts.failed_tasks += 1
    }

    return counts
  }, {
    active_tasks: 0,
    blocked_tasks: 0,
    stuck_tasks: 0,
    failed_tasks: 0,
  })
}

export function countAliveAgents(agents = [], maxAgeMinutes = ALIVE_WINDOW_MINUTES) {
  return agents.filter((agent) => {
    if (typeof agent?.age === 'number') {
      return agent.age < maxAgeMinutes
    }

    if (typeof agent?.updated_at === 'string') {
      return Date.now() - new Date(agent.updated_at).getTime() < maxAgeMinutes * 60 * 1_000
    }

    return false
  }).length
}

export function toGlobalStatus({
  dashboard = null,
  services = [],
  vitals = {},
  usage = {},
  agentsTotal = DEFAULT_AGENTS_TOTAL,
} = {}) {
  const status = createEmptyStatus({ agentsTotal })
  const taskCounts = buildTaskCounts(dashboard?.tasks ?? [])
  const gateway = services.find((service) => service.name === 'openclaw-gateway')

  return {
    ...status,
    agents_alive: countAliveAgents(dashboard?.agents ?? []),
    ...taskCounts,
    gateway_up: Boolean(gateway?.active),
    failed_services: services.filter((service) => !service.active).length,
    cpu_percent: Number.isFinite(vitals.cpu_percent) ? vitals.cpu_percent : 0,
    cpu_temp: Number.isFinite(vitals.cpu_temp) ? vitals.cpu_temp : 0,
    claude_usage_percent: Number.isFinite(usage.claude_usage_percent)
      ? usage.claude_usage_percent
      : 0,
    codex_usage_percent: Number.isFinite(usage.codex_usage_percent)
      ? usage.codex_usage_percent
      : 0,
  }
}

async function readIsActive(execImpl, args) {
  try {
    const { stdout } = await execImpl('systemctl', args, { timeout: 2_000 })
    return stdout.trim() === 'active'
  } catch (error) {
    const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : ''
    if (stdout) {
      return stdout === 'active'
    }
    return null
  }
}

async function loadServiceStatuses({
  execImpl = execFileAsync,
  serviceNames = MONITORED_SERVICES,
} = {}) {
  return Promise.all(serviceNames.map(async (name) => {
    const userStatus = await readIsActive(execImpl, ['--user', 'is-active', name])
    const active = userStatus ?? await readIsActive(execImpl, ['is-active', name]) ?? false
    return { name, active }
  }))
}

async function loadDashboardSnapshot({
  execImpl = execFileAsync,
  dashboardScript = DASHBOARD_SCRIPT,
} = {}) {
  try {
    const { stdout } = await execImpl('node', [dashboardScript, 'json'], { timeout: 3_000 })
    return JSON.parse(stdout)
  } catch {
    return null
  }
}

async function getCached(cache, key, ttlMs, load) {
  if (!cache) {
    return load()
  }

  const existing = cache.get(key)
  if (existing !== undefined) {
    return existing
  }

  const value = await load()
  cache.set(key, value, ttlMs)
  return value
}

export function createStatusService({
  cache = null,
  vitalsMonitor = null,
  execImpl = execFileAsync,
  dashboardScript = DASHBOARD_SCRIPT,
  runtimeDir,
  serviceNames = MONITORED_SERVICES,
  agentsTotal = DEFAULT_AGENTS_TOTAL,
} = {}) {
  return {
    async getStatus() {
      const [dashboard, services, vitals, usage] = await Promise.all([
        loadDashboardSnapshot({ execImpl, dashboardScript }),
        getCached(cache, 'status:services', SERVICE_CACHE_TTL_MS, () =>
          loadServiceStatuses({ execImpl, serviceNames })),
        getCached(cache, 'status:vitals', VITALS_CACHE_TTL_MS, async () =>
          vitalsMonitor?.getSnapshot?.() ?? { cpu_percent: 0, cpu_temp: 0 }),
        readRateLimitSnapshot({ runtimeDir }),
      ])

      return toGlobalStatus({
        dashboard,
        services,
        vitals,
        usage,
        agentsTotal,
      })
    },
  }
}
