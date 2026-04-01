// Tasks API — wraps task-store.js CLI (no re-implemented business logic)
import { Router } from 'express'
import { execFile } from 'child_process'
import { createReadStream, readFileSync, mkdirSync, appendFileSync, existsSync } from 'fs'
import { createInterface } from 'readline'
import { join } from 'path'

const router = Router()

const TASK_STORE = join(process.env.HOME, 'clawd/scripts/task-store.js')
const TASKS_DIR = join(process.env.HOME, 'clawd/tasks')
const GH_BIN = '/home/aiadmin/.local/bin/gh'
const AO_URL = 'http://127.0.0.1:3100/api/sessions'

const AO_STATUS_MAP = {
  spawning: 'EXECUTION', ready: 'EXECUTION', working: 'EXECUTION',
  pr_open: 'REVIEW_PENDING', ci_failed: 'CI_PENDING',
  review_pending: 'REVIEW_PENDING', changes_requested: 'REVIEW_PENDING',
  approved: 'QUALITY_GATE', mergeable: 'QUALITY_GATE',
  merged: 'DONE', needs_input: 'AWAITING_OWNER',
  stuck: 'STUCK', errored: 'FAILED', killed: 'FAILED', done: 'DONE',
}

function ghIssues(repo) {
  return new Promise((resolve) => {
    execFile(GH_BIN, ['issue', 'list', '--repo', repo, '--state', 'all',
      '--json', 'number,title,state,labels,createdAt,closedAt',
      '--limit', '50'], { timeout: 15000 }, (err, stdout) => {
      if (err) return resolve([])
      try { resolve(JSON.parse(stdout)) } catch { resolve([]) }
    })
  })
}

async function aoSessions() {
  try {
    const r = await fetch(AO_URL)
    const d = await r.json()
    return d.sessions || d || []
  } catch { return [] }
}

async function getGitHubTasks() {
  const repos = ['aerbaser/ao-dashboard', 'aerbaser/sokrat-core']
  const [issueArrays, sessions] = await Promise.all([
    Promise.all(repos.map(ghIssues)), aoSessions()
  ])
  const sessionMap = new Map()
  for (const s of sessions) {
    const n = s.issueId || s.issueNumber
    if (n) {
      const k = `${s.projectId}#${n}`
      if (!sessionMap.has(k) || new Date(s.createdAt) > new Date(sessionMap.get(k).createdAt))
        sessionMap.set(k, s)
    }
  }
  const tasks = []
  for (let ri = 0; ri < repos.length; ri++) {
    const pid = repos[ri].split('/')[1]
    for (const issue of issueArrays[ri]) {
      const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name)
      const agentLabel = labels.find(l => l.startsWith('agent:'))
      const session = sessionMap.get(`${pid}#${issue.number}`)

      let state = 'PLANNING'
      let owner = 'platon'

      if (issue.state === 'CLOSED' || issue.closedAt) {
        state = 'DONE'
      } else if (session) {
        state = AO_STATUS_MAP[session.status] || 'EXECUTION'
        owner = 'archimedes'
      } else if (!agentLabel) {
        state = 'INTAKE'
        owner = 'unrouted'
      } else if (agentLabel === 'agent:backlog') {
        state = 'PLANNING'
      } else if (agentLabel === 'agent:archimedes') {
        state = 'SETUP'
      } else {
        // Other agent labels (agent:hephaestus, agent:platon, etc.)
        state = 'INTAKE'
        owner = agentLabel.replace('agent:', '')
      }

      tasks.push({
        task_id: `gh-${pid}-${issue.number}`,
        contract: { title: issue.title, route: 'build_route', outcome_type: 'app_release' },
        status: { state, current_owner: owner, current_route: 'build_route',
          blockers: [], retries: 0, updated_at: issue.closedAt || issue.createdAt,
          last_material_update: issue.closedAt || issue.createdAt },
        actors: session ? ['platon', 'archimedes'] : ['platon'],
      })
    }
  }
  return tasks
}
const AUDIT_LOG = '/tmp/openclaw/ao-dashboard-actions.log'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Run task-store.js with args array (no shell interpolation). */
function runTaskStore(args) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    execFile('node', [TASK_STORE, ...args], { timeout: 15_000 }, (err, stdout, stderr) => {
      const duration_ms = Date.now() - start
      if (err) {
        reject({ stdout, stderr: stderr || err.message, duration_ms, code: err.code })
      } else {
        resolve({ stdout, stderr, duration_ms })
      }
    })
  })
}

/** Read an NDJSON file line-by-line into an array. */
function readNDJSON(filePath) {
  return new Promise((resolve, reject) => {
    if (!existsSync(filePath)) return resolve([])
    const items = []
    const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity })
    rl.on('line', line => {
      const trimmed = line.trim()
      if (!trimmed) return
      try { items.push(JSON.parse(trimmed)) } catch { /* skip malformed lines */ }
    })
    rl.on('close', () => resolve(items))
    rl.on('error', reject)
  })
}

/** Extract last agent (non-owner) comment text from events, truncated to 120 chars. */
function extractLastAgentMessage(events) {
  let last = null
  for (const ev of events) {
    const type = ev.event_type || ev.type
    if (type === 'USER_COMMENT' && ev.actor && ev.actor !== 'owner') {
      last = ev
    }
  }
  if (!last) return null
  const payload = last.payload || {}
  const body = last.body || payload.body || ''
  return body ? body.slice(0, 120) : null
}

/** Extract unique actors in chronological (first-seen) order from events array. */
function extractActors(events) {
  const seen = new Set()
  const actors = []
  for (const ev of events) {
    const actor = ev.actor
    if (actor && typeof actor === 'string' && !seen.has(actor)) {
      seen.add(actor)
      actors.push(actor)
    }
  }
  return actors
}

/** Append one line to the audit log. Creates dir/file if needed. */
function auditLog(entry) {
  try {
    mkdirSync('/tmp/openclaw', { recursive: true })
    appendFileSync(AUDIT_LOG, JSON.stringify(entry) + '\n', 'utf8')
  } catch (e) {
    console.error('[audit-log] write failed:', e.message)
  }
}

/** Validate request body: reject unknown fields, require required fields. */
function validateBody(body, allowedFields, requiredFields = []) {
  const unknown = Object.keys(body).filter(k => !allowedFields.includes(k))
  if (unknown.length > 0) {
    return { ok: false, error: 'UNKNOWN_FIELDS', detail: `Unknown fields: ${unknown.join(', ')}` }
  }
  for (const f of requiredFields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      return { ok: false, error: 'MISSING_FIELD', detail: `Required field missing: ${f}` }
    }
  }
  return null
}

/** Check if a guard-violation message is in stderr. */
function isGuardViolation(stderr) {
  return stderr && (stderr.includes('blocked:') || stderr.includes('GUARD_VIOLATION'))
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
// List all tasks (delegates to task-store.js list but returns structured JSON)

router.get('/', async (_req, res) => {
  try {
    const tasks = []
    // 1. Task-ledger
    try {
      const { readdirSync, readFileSync } = await import('fs')
      const dirs = readdirSync(TASKS_DIR).filter(d => d.startsWith('tsk_'))
      for (const id of dirs) {
        try {
          const contract = JSON.parse(readFileSync(join(TASKS_DIR, id, 'contract.json'), 'utf8'))
          const status = JSON.parse(readFileSync(join(TASKS_DIR, id, 'status.json'), 'utf8'))
          const events = await readNDJSON(join(TASKS_DIR, id, 'events.ndjson'))
          const actors = extractActors(events)
          const lastAgentMessage = extractLastAgentMessage(events)
          tasks.push({ task_id: id, contract, status, actors, lastAgentMessage })
        } catch { /* skip */ }
      }
    } catch { /* dir may not exist */ }
    // 2. GitHub issues
    try {
      const ghTasks = await getGitHubTasks()
      tasks.push(...ghTasks)
    } catch (e) { console.error('[tasks] gh fetch:', e.message) }
    res.json(tasks)
  } catch (e) {
    res.status(500).json({ ok: false, error: 'INTERNAL', detail: e.message })
  }
})

// ─── GET /api/tasks/:id ──────────────────────────────────────────────────────
// Return task detail with events and decisions

router.get('/:id', async (req, res) => {
  const { id } = req.params
  const dir = join(TASKS_DIR, id)

  try {
    const { readFileSync } = await import('fs')
    if (!existsSync(dir)) {
      return res.status(404).json({ ok: false, error: 'NOT_FOUND', detail: `Task ${id} not found` })
    }

    const contract = JSON.parse(readFileSync(join(dir, 'contract.json'), 'utf8'))
    const status = JSON.parse(readFileSync(join(dir, 'status.json'), 'utf8'))
    const [events, decisions] = await Promise.all([
      readNDJSON(join(dir, 'events.ndjson')),
      readNDJSON(join(dir, 'decision-log.jsonl')),
    ])
    const actors = extractActors(events)

    res.json({ task_id: id, contract, status, events, decisions, actors })
  } catch (e) {
    res.status(500).json({ ok: false, error: 'INTERNAL', detail: e.message })
  }
})

// ─── POST /api/tasks ─────────────────────────────────────────────────────────
// Create a new task

const CREATE_ALLOWED = ['title', 'route', 'outcome_type', 'delivery_mode', 'owner', 'raw_request']

router.post('/', async (req, res) => {
  const validation = validateBody(req.body, CREATE_ALLOWED, ['title'])
  if (validation) return res.status(400).json(validation)

  const { title, route, outcome_type, delivery_mode, owner, raw_request } = req.body
  const args = ['create', '--title', title]
  if (route) args.push('--route', route)
  if (outcome_type) args.push('--outcome', outcome_type)
  if (delivery_mode) args.push('--delivery_mode', delivery_mode)
  if (owner) args.push('--owner', owner)
  if (raw_request) args.push('--raw_request', raw_request)

  const start = Date.now()
  try {
    const { stdout, duration_ms } = await runTaskStore(args)
    // Parse task_id from stdout: "✅ Task created: tsk_..."
    const match = stdout.match(/tsk_\w+/)
    const task_id = match ? match[0] : null

    auditLog({
      ts: new Date().toISOString(),
      action: 'task.create',
      actor: 'dashboard',
      target: task_id,
      params: { title, route, outcome_type },
      result_ok: true,
      duration_ms,
    })

    res.status(201).json({ ok: true, task_id })
  } catch (e) {
    auditLog({
      ts: new Date().toISOString(),
      action: 'task.create',
      actor: 'dashboard',
      target: null,
      params: { title, route, outcome_type },
      result_ok: false,
      duration_ms: Date.now() - start,
    })
    res.status(500).json({ ok: false, error: 'CREATE_FAILED', detail: e.stderr })
  }
})

// ─── State machine — valid transitions ───────────────────────────────────────

const STATE_TRANSITIONS = {
  INTAKE:          ['CONTEXT', 'BLOCKED'],
  CONTEXT:         ['RESEARCH', 'BLOCKED'],
  RESEARCH:        ['DESIGN', 'BLOCKED'],
  DESIGN:          ['PLANNING', 'BLOCKED'],
  PLANNING:        ['SETUP', 'BLOCKED'],
  SETUP:           ['EXECUTION', 'BLOCKED'],
  EXECUTION:       ['REVIEW_PENDING', 'AWAITING_OWNER', 'BLOCKED'],
  AWAITING_OWNER:  ['EXECUTION', 'BLOCKED'],
  REVIEW_PENDING:  ['CI_PENDING', 'EXECUTION'],
  CI_PENDING:      ['QUALITY_GATE', 'FAILED'],
  QUALITY_GATE:    ['FINALIZING', 'EXECUTION'],
  FINALIZING:      ['DEPLOYING', 'DONE'],
  DEPLOYING:       ['OBSERVING', 'FAILED'],
  OBSERVING:       ['DONE', 'FAILED'],
  DONE:            [],
  BLOCKED:         ['EXECUTION'],
  FAILED:          ['EXECUTION'],
  STUCK:           ['EXECUTION'],
  WAITING_USER:    ['EXECUTION'],
}

/** Read current state from task status.json */
function readTaskState(taskId) {
  const statusPath = join(TASKS_DIR, taskId, 'status.json')
  if (!existsSync(statusPath)) return null
  try {
    return JSON.parse(readFileSync(statusPath, 'utf8')).state || null
  } catch { return null }
}

// ─── POST /api/tasks/:id/transition ──────────────────────────────────────────

const TRANSITION_ALLOWED = ['state', 'actor', 'reason', 'recovery', 'next_action', 'force',
  'blockers', 'deadline_at', 'expires_at']

router.post('/:id/transition', async (req, res) => {
  const { id } = req.params
  const validation = validateBody(req.body, TRANSITION_ALLOWED, ['state'])
  if (validation) return res.status(400).json(validation)

  const { state, actor, reason, recovery, next_action, force, blockers, deadline_at, expires_at } = req.body

  // Validate transition against state machine (unless force)
  if (!force) {
    const currentState = readTaskState(id)
    if (currentState) {
      const allowed = STATE_TRANSITIONS[currentState] || []
      if (!allowed.includes(state)) {
        return res.status(422).json({
          ok: false,
          error: 'INVALID_TRANSITION',
          detail: `Transition from ${currentState} to ${state} is not allowed. Valid transitions: ${allowed.join(', ') || 'none'}`,
        })
      }
    }
  }

  const args = ['transition', id, state]
  if (actor) args.push('--actor', actor)
  if (reason) args.push('--reason', reason)
  if (recovery) args.push('--recovery', recovery)
  if (next_action) args.push('--next_action', next_action)
  if (force) args.push('--force')
  if (blockers) args.push('--blockers', JSON.stringify(blockers))
  if (deadline_at) args.push('--deadline_at', deadline_at)
  if (expires_at) args.push('--expires_at', expires_at)

  const start = Date.now()
  try {
    const { duration_ms } = await runTaskStore(args)
    auditLog({
      ts: new Date().toISOString(),
      action: 'task.transition',
      actor: actor || 'dashboard',
      target: id,
      params: { state },
      result_ok: true,
      duration_ms,
    })
    res.json({ ok: true })
  } catch (e) {
    const duration_ms = Date.now() - start
    auditLog({
      ts: new Date().toISOString(),
      action: 'task.transition',
      actor: actor || 'dashboard',
      target: id,
      params: { state },
      result_ok: false,
      duration_ms,
    })

    if (isGuardViolation(e.stderr)) {
      return res.status(422).json({ ok: false, error: 'GUARD_VIOLATION', detail: e.stderr.trim() })
    }
    res.status(500).json({ ok: false, error: 'TRANSITION_FAILED', detail: e.stderr })
  }
})

// ─── POST /api/tasks/:id/event ───────────────────────────────────────────────

const EVENT_ALLOWED = ['type', 'payload']

router.post('/:id/event', async (req, res) => {
  const { id } = req.params
  const validation = validateBody(req.body, EVENT_ALLOWED, ['type'])
  if (validation) return res.status(400).json(validation)

  const { type, payload } = req.body
  const dataJson = payload ? JSON.stringify(payload) : '{}'
  const args = ['event', id, type, dataJson]

  const start = Date.now()
  try {
    const { duration_ms } = await runTaskStore(args)
    auditLog({
      ts: new Date().toISOString(),
      action: 'task.event',
      actor: 'dashboard',
      target: id,
      params: { type },
      result_ok: true,
      duration_ms,
    })
    res.json({ ok: true })
  } catch (e) {
    auditLog({
      ts: new Date().toISOString(),
      action: 'task.event',
      actor: 'dashboard',
      target: id,
      params: { type },
      result_ok: false,
      duration_ms: Date.now() - start,
    })
    res.status(500).json({ ok: false, error: 'EVENT_FAILED', detail: e.stderr })
  }
})

// ─── POST /api/tasks/:id/decision ────────────────────────────────────────────

const DECISION_ALLOWED = ['gate_type', 'result', 'rationale', 'resolved_by', 'resolution_mode', 'summary']

router.post('/:id/decision', async (req, res) => {
  const { id } = req.params
  const validation = validateBody(req.body, DECISION_ALLOWED)
  if (validation) return res.status(400).json(validation)

  const dataJson = JSON.stringify(req.body)
  const args = ['decision', id, dataJson]

  const start = Date.now()
  try {
    const { duration_ms } = await runTaskStore(args)
    auditLog({
      ts: new Date().toISOString(),
      action: 'task.decision',
      actor: 'dashboard',
      target: id,
      params: req.body,
      result_ok: true,
      duration_ms,
    })
    res.json({ ok: true })
  } catch (e) {
    auditLog({
      ts: new Date().toISOString(),
      action: 'task.decision',
      actor: 'dashboard',
      target: id,
      params: req.body,
      result_ok: false,
      duration_ms: Date.now() - start,
    })
    res.status(500).json({ ok: false, error: 'DECISION_FAILED', detail: e.stderr })
  }
})

export default router
