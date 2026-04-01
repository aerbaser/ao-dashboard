// GET /api/status aggregator — assembles 12 GlobalStatus fields.
// Uses TTL cache for services (10s) and vitals (from background worker).
// Heartbeats and tasks are read live (fast file reads / CLI calls).
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as cache from './cache.js'
import { getVitals } from './vitals.js'

const execFileAsync = promisify(execFile)

const IDEAS_DIR = join(process.env.HOME ?? '', 'clawd/ideas')
const RUNTIME_DIR = join(process.env.HOME ?? '', 'clawd/runtime')
const HEARTBEATS_DIR = join(RUNTIME_DIR, 'heartbeats')
const RATE_LIMIT_CACHE = join(RUNTIME_DIR, 'rate-limit-cache.json')
const TASK_STORE_CLI = join(process.env.HOME ?? '', 'clawd/scripts/task-store.js')

const SERVICES_TTL = 10_000 // 10s
const HEARTBEAT_MAX_AGE_MS = 5 * 60 * 1000 // 5 min
const AGENTS_TOTAL = 9

// ── Heartbeats (live — fast file reads) ──────────────────────────────────

async function getHeartbeats() {
  try {
    const files = await readdir(HEARTBEATS_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    const heartbeats = await Promise.all(
      jsonFiles.map(async f => {
        try {
          const raw = await readFile(join(HEARTBEATS_DIR, f), 'utf8')
          return JSON.parse(raw)
        } catch {
          return null
        }
      })
    )
    return heartbeats.filter(Boolean)
  } catch {
    return []
  }
}

function countAliveAgents(heartbeats) {
  const now = Date.now()
  return heartbeats.filter(h => {
    const updated = h.updated_at ? new Date(h.updated_at).getTime() : 0
    return now - updated < HEARTBEAT_MAX_AGE_MS
  }).length
}

// ── Tasks (live — call task-store.js CLI) ────────────────────────────────

const TERMINAL_STATES = new Set(['DONE', 'FAILED', 'CANCELLED', 'SUPERSEDED'])
const ACTIVE_STATES = new Set([
  'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING', 'SETUP',
  'EXECUTION', 'REVIEW_PENDING', 'CI_PENDING', 'QUALITY_GATE',
  'FINALIZING', 'DEPLOYING', 'OBSERVING', 'IN_REWORK',
])

async function getTaskCounts() {
  try {
    const { stdout } = await execFileAsync('node', [TASK_STORE_CLI, 'list'], {
      timeout: 5000,
    })
    // Parse the table output — each line: TASK_ID | STATE | ...
    const lines = stdout.split('\n').filter(l => l.includes('|'))
    // Skip header line
    const dataLines = lines.slice(1)
    let active = 0
    let blocked = 0
    let stuck = 0
    let failed = 0

    for (const line of dataLines) {
      const cols = line.split('|').map(c => c.trim())
      const state = (cols[1] ?? '').toUpperCase()
      if (ACTIVE_STATES.has(state)) active++
      if (state === 'BLOCKED') blocked++
      if (state === 'STUCK') stuck++
      if (state === 'FAILED') failed++
    }

    return { active_tasks: active, blocked_tasks: blocked, stuck_tasks: stuck, failed_tasks: failed }
  } catch {
    return { active_tasks: 0, blocked_tasks: 0, stuck_tasks: 0, failed_tasks: 0 }
  }
}

// ── Services (cached 10s — systemctl is expensive) ───────────────────────

const WATCHED_SERVICES = [
  'openclaw-gateway',
  'ao-dashboard',
  'ao-orchestrator',
]

async function isServiceActive(svc) {
  // Try user scope first, then system scope
  for (const args of [['--user', 'is-active', svc], ['is-active', svc]]) {
    try {
      const { stdout } = await execFileAsync('systemctl', args, { timeout: 3000 })
      if (stdout.trim() === 'active') return true
    } catch { /* not active in this scope */ }
  }
  return false
}

async function fetchServices() {
  const cached = cache.get('services')
  if (cached) return cached

  try {
    const results = await Promise.all(
      WATCHED_SERVICES.map(async svc => ({
        name: svc,
        active: await isServiceActive(svc),
      }))
    )
    cache.set('services', results, SERVICES_TTL)
    return results
  } catch {
    return WATCHED_SERVICES.map(svc => ({ name: svc, active: false }))
  }
}

// ── Rate-limit usage (from cache file) ───────────────────────────────────

async function getUsagePercents() {
  try {
    const raw = await readFile(RATE_LIMIT_CACHE, 'utf8')
    const data = JSON.parse(raw)
    const profiles = Array.isArray(data.profiles) ? data.profiles : []

    let claudeUsage = 0
    let codexUsage = 0

    for (const p of profiles) {
      const pct = p.tokens_limit > 0
        ? Math.round((p.tokens_used / p.tokens_limit) * 100)
        : 0
      // Heuristic: "codex" in profile name → codex, otherwise claude
      if (p.profile?.toLowerCase().includes('codex')) {
        codexUsage = Math.max(codexUsage, pct)
      } else {
        claudeUsage = Math.max(claudeUsage, pct)
      }
    }

    return { claude_usage_percent: claudeUsage, codex_usage_percent: codexUsage }
  } catch {
    return { claude_usage_percent: 0, codex_usage_percent: 0 }
  }
}

// ── Ideas actionable count ───────────────────────────────────────────────

async function getIdeasCounts() {
  try {
    const files = await readdir(IDEAS_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    let actionable = 0
    let pendingApproval = 0
    for (const f of jsonFiles) {
      try {
        const raw = await readFile(join(IDEAS_DIR, f), 'utf8')
        const idea = JSON.parse(raw)
        if (idea.status === 'draft' || idea.status === 'artifact_ready') actionable++
        if (idea.status === 'pending_approval') pendingApproval++
      } catch { /* skip malformed */ }
    }
    return { ideas_actionable: actionable, approvals_pending: pendingApproval }
  } catch {
    return { ideas_actionable: 0, approvals_pending: 0 }
  }
}

// ── Main aggregator ──────────────────────────────────────────────────────

export async function getGlobalStatus() {
  // Run all independent reads in parallel
  const [heartbeats, taskCounts, services, usage, vitals, ideasCounts] = await Promise.all([
    getHeartbeats(),
    getTaskCounts(),
    fetchServices(),
    getUsagePercents(),
    Promise.resolve(getVitals()),
    getIdeasCounts(),
  ])

  const gatewayEntry = services.find(s => s.name === 'openclaw-gateway')
  const failedServices = services.filter(s => !s.active).length

  return {
    gateway_up: gatewayEntry?.active ?? false,
    agents_alive: countAliveAgents(heartbeats),
    agents_total: AGENTS_TOTAL,
    ...taskCounts,
    failed_services: failedServices,
    ...vitals,
    ...usage,
    ...ideasCounts,
  }
}
