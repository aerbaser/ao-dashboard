// GET /api/status — assemble GlobalStatus from ao-dashboard.js json + system vitals
import { Router } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const exec = promisify(execFile)
const router = Router()

let cachedResult = null
let cachedAt = 0
const CACHE_TTL_MS = 4000 // cache for 4s (poll is 5s)

async function readCpuTemp() {
  try {
    const zones = ['/sys/class/thermal/thermal_zone0/temp']
    for (const z of zones) {
      const raw = await readFile(z, 'utf-8')
      return Math.round(parseInt(raw, 10) / 1000)
    }
  } catch {
    return null
  }
}

async function readCpuPercent() {
  try {
    const { stdout } = await exec('grep', ['-c', '^processor', '/proc/cpuinfo'])
    const cpuCount = parseInt(stdout.trim(), 10) || 1
    const load = await readFile('/proc/loadavg', 'utf-8')
    const load1 = parseFloat(load.split(' ')[0])
    return Math.min(100, Math.round((load1 / cpuCount) * 100))
  } catch {
    return null
  }
}

async function fetchDashboardJson() {
  const script = join(homedir(), 'clawd/scripts/ao-dashboard.js')
  const { stdout } = await exec('node', [script, 'json'], { timeout: 3000 })
  return JSON.parse(stdout)
}

async function assembleStatus() {
  const now = Date.now()
  if (cachedResult && (now - cachedAt) < CACHE_TTL_MS) {
    return cachedResult
  }

  const [dashData, cpuTemp, cpuPercent] = await Promise.all([
    fetchDashboardJson().catch(() => null),
    readCpuTemp(),
    readCpuPercent(),
  ])

  // Extract agent stats
  const AGENTS_TOTAL = 9  // static team size: archimedes, aristotle, brainstorm, hephaestus, herodotus, leo, platon, sokrat, sokrat-brainstorm
  const agents = dashData?.agents ?? []
  const agentsAlive = agents.filter(a => a.state === 'active' || a.state === 'idle').length
  const agentsTotal = AGENTS_TOTAL

  // Extract task stats from health or tasks array
  const health = dashData?.health ?? {}
  const tasks = dashData?.tasks ?? []
  const activeTasks = health.active_tasks ?? tasks.filter(t => !['DONE', 'FAILED'].includes(t.state)).length
  const blockedTasks = health.blocked_tasks ?? tasks.filter(t => t.state === 'BLOCKED').length
  const stuckTasks = health.stale_tasks ?? tasks.filter(t => t.state === 'STUCK').length

  // Gateway check: if ao-dashboard.js responded, gateway is up
  const gatewayUp = dashData !== null

  // Failed services — check systemd if available
  let failedServices = 0
  try {
    const { stdout } = await exec('systemctl', ['--user', 'list-units', '--state=failed', '--no-legend', '--no-pager'], { timeout: 2000 })
    failedServices = stdout.trim().split('\n').filter(l => l.trim()).length
  } catch {
    // not available or no failures
  }

  // Claude/Codex usage — read from rate-limit-cache.json (written by gateway on each API call)
  let claudeUsagePercent = null
  let codexUsagePercent = null
  try {
    const cachePath = join(homedir(), 'clawd/runtime/rate-limit-cache.json')
    const cacheRaw = await readFile(cachePath, 'utf-8')
    const cache = JSON.parse(cacheRaw)
    const profiles = Array.isArray(cache.profiles) ? cache.profiles : []
    // Yura profile = primary Claude usage
    const yura = profiles.find((p) => p.profile === 'yura')
    if (yura && yura.tokens_limit > 0) {
      claudeUsagePercent = Math.round((yura.tokens_used / yura.tokens_limit) * 100)
    }
    // Codex profile
    const codex = profiles.find((p) => p.profile === 'codex')
    if (codex && codex.tokens_limit > 0) {
      codexUsagePercent = Math.round((codex.tokens_used / codex.tokens_limit) * 100)
    }
  } catch {
    // cache not available — return null (UI shows '—')
  }

  const result = {
    gateway_up: gatewayUp,
    agents_alive: agentsAlive,
    agents_total: agentsTotal,
    active_tasks: activeTasks,
    blocked_tasks: blockedTasks,
    stuck_tasks: stuckTasks,
    failed_services: failedServices,
    cpu_percent: cpuPercent,
    cpu_temp: cpuTemp,
    claude_usage_percent: claudeUsagePercent,
    codex_usage_percent: codexUsagePercent,
    timestamp: new Date().toISOString(),
  }

  cachedResult = result
  cachedAt = now
  return result
}

router.get('/', async (_req, res) => {
  try {
    const status = await assembleStatus()
    res.json(status)
  } catch (err) {
    res.status(500).json({ error: 'Failed to assemble status', detail: err.message })
  }
})

export default router
