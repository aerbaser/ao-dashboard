import { Router } from 'express'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { execFile } from 'child_process'
import { existsSync } from 'fs'

const router = Router()
const HOME = process.env.HOME || '/home/aiadmin'
const IDEAS_DIR = join(HOME, 'clawd/ideas')
const SESSIONS_SEND = join(HOME, 'clawd/scripts/sessions-send.js')
const MAILBOXES_DIR = join(HOME, 'clawd/runtime/mailboxes')
const TASK_STORE = join(HOME, 'clawd/scripts/task-store.js')

const VALID_STATUSES = ['draft', 'brainstorming', 'artifact_ready', 'approved', 'in_work', 'archived', 'reviewed', 'approval_needed']
// In-process lock: tracks idea IDs currently being routed. The check+add is
// synchronous so it is atomic with respect to the Node.js event loop.
const routingInFlight = new Set()
const VALID_AGENTS = ['brainstorm-claude', 'brainstorm-codex', 'sokrat']
const VALID_ID_RE = /^idea_\d{8}_[a-f0-9]{6}$/
const APPROVAL_QUEUE_STATES = new Set(['pending', 'later', 'no', 'rescope', 'routing_failed', 'routed', 'routing_in_progress'])
const APPROVAL_DECISIONS = new Map([
  ['yes', 'routed'],
  ['later', 'later'],
  ['no', 'no'],
  ['rescope', 'rescope'],
])

/** Validate idea :id param — prevents path traversal */
function validateId(req, res) {
  const { id } = req.params
  if (!VALID_ID_RE.test(id)) {
    res.status(400).json({ error: `Invalid idea id format: ${id}` })
    return false
  }
  return true
}

async function ensureDir() {
  await mkdir(IDEAS_DIR, { recursive: true })
}

async function safeReadJson(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function generateId() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const hex = randomBytes(3).toString('hex')
  return `idea_${date}_${hex}`
}

function normalizeApproval(idea) {
  const approval = idea?.approval
  if (approval && APPROVAL_QUEUE_STATES.has(approval.state)) {
    return {
      state: approval.state,
      requested_at: approval.requested_at || approval.pending_since || idea.updated_at || idea.created_at || null,
      reason: approval.reason || approval.decision_note || idea.review_note || 'Approval required before routing',
      route: approval.route || 'artifact_route',
      expected_outcome: approval.expected_outcome || 'strategy_doc',
      owner: approval.owner || 'platon',
      next_action: approval.next_action || (approval.state === 'routed' && approval.task_id
        ? `Track routed task ${approval.task_id}`
        : 'Await operator decision'),
      decided_at: approval.decided_at || null,
      decided_by: approval.decided_by || null,
      decision_note: approval.decision_note || null,
      task_id: approval.task_id || idea.task_id || null,
      error: approval.error || null,
    }
  }

  if (idea?.status === 'artifact_ready') {
    return {
      state: 'pending',
      requested_at: idea.updated_at || idea.created_at || null,
      reason: 'Artifact is ready and needs product approval before routing',
      route: 'artifact_route',
      expected_outcome: 'strategy_doc',
      owner: 'platon',
      next_action: 'Review the artifact and decide whether to route it',
      decided_at: null,
      decided_by: null,
      decision_note: null,
      task_id: idea.task_id || null,
      error: null,
    }
  }

  if (idea?.status === 'reviewed') {
    return {
      state: 'pending',
      requested_at: idea.reviewed_at || idea.updated_at || idea.created_at || null,
      reason: idea.review_note || 'Reviewed and waiting for approval before routing',
      route: 'artifact_route',
      expected_outcome: 'strategy_doc',
      owner: idea.target_agent || 'platon',
      next_action: 'Review the idea and decide whether to route it',
      decided_at: null,
      decided_by: null,
      decision_note: null,
      task_id: idea.task_id || null,
      error: null,
    }
  }

  return null
}

function toApprovalQueueItem(idea) {
  const approval = normalizeApproval(idea)
  if (!approval) return null

  return {
    id: idea.id,
    title: idea.title,
    why: approval.reason,
    route: approval.route,
    expected_outcome: approval.expected_outcome,
    owner: approval.owner,
    pending_since: approval.requested_at,
    freshness_updated_at: idea.updated_at || approval.requested_at,
    next_action: approval.next_action,
    approval_state: approval.state,
    task_id: approval.task_id,
    decision_note: approval.decision_note,
    error: approval.error,
    idea_status: idea.status || 'draft',
  }
}

function sortQueue(a, b) {
  const aTs = a.pending_since || a.freshness_updated_at || ''
  const bTs = b.pending_since || b.freshness_updated_at || ''
  return bTs.localeCompare(aTs)
}

function runTaskStore(args) {
  return new Promise((resolve, reject) => {
    execFile('node', [TASK_STORE, ...args], { timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error((stderr || err.message || '').trim()))
        return
      }
      resolve((stdout || '').trim())
    })
  })
}

async function createApprovalTask(idea, approval) {
  const args = ['create', '--title', idea.title]
  if (approval.route) args.push('--route', approval.route)
  if (approval.expected_outcome) args.push('--outcome', approval.expected_outcome)
  if (idea.body) args.push('--raw_request', idea.body)

  const stdout = await runTaskStore(args)
  const taskId = stdout.match(/tsk_[A-Za-z0-9_]+/)?.[0]
  if (!taskId) {
    throw new Error(`Task creation succeeded but no task id was returned: ${stdout}`)
  }
  return taskId
}

async function logTaskDecision(taskId, ideaId, note) {
  const summary = note || `Idea ${ideaId} approved and routed`
  await runTaskStore([
    'decision',
    taskId,
    JSON.stringify({
      gate_type: 'idea_approval',
      result: 'yes',
      resolved_by: 'dashboard',
      resolution_mode: 'operator_override',
      summary,
      idea_id: ideaId,
    }),
  ])
  await runTaskStore([
    'event',
    taskId,
    'IDEA_APPROVED_AND_ROUTED',
    JSON.stringify({
      actor: 'dashboard',
      idea_id: ideaId,
      note: note || null,
    }),
  ])
}

// GET /api/ideas — list all (with optional ?status= filter)
router.get('/', async (req, res) => {
  try {
    await ensureDir()
    const files = await readdir(IDEAS_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    const ideas = (await Promise.all(
      jsonFiles.map(f => safeReadJson(join(IDEAS_DIR, f)))
    )).filter(Boolean)

    const statusFilter = req.query.status
    const filtered = statusFilter
      ? ideas.filter(i => i.status === statusFilter)
      : ideas

    // Sort by updated_at descending
    filtered.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))

    res.json(filtered)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/ideas/approval-queue — first-class approval lane
router.get('/approval-queue', async (_req, res) => {
  try {
    await ensureDir()
    const files = await readdir(IDEAS_DIR)
    const jsonFiles = files.filter(f => f.endsWith('.json'))
    const ideas = (await Promise.all(
      jsonFiles.map(f => safeReadJson(join(IDEAS_DIR, f)))
    )).filter(Boolean)

    const queue = ideas
      .map(toApprovalQueueItem)
      .filter(Boolean)
      .sort(sortQueue)

    res.json(queue)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/ideas — create new idea
router.post('/', async (req, res) => {
  try {
    await ensureDir()
    const { title, body, tags, target_agent } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' })
    }

    const now = new Date().toISOString()
    const idea = {
      id: generateId(),
      title: title.trim(),
      body: (body || '').trim(),
      status: 'draft',
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
      target_agent: VALID_AGENTS.includes(target_agent) ? target_agent : 'brainstorm-claude',
      created_at: now,
      updated_at: now,
    }

    await writeFile(join(IDEAS_DIR, `${idea.id}.json`), JSON.stringify(idea, null, 2))
    res.status(201).json(idea)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/ideas/:id — update idea
router.put('/:id', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    const existing = await safeReadJson(filePath)
    if (!existing) {
      return res.status(404).json({ error: 'idea not found' })
    }

    const { title, body, status, tags, target_agent, artifact, task_id } = req.body

    if (title !== undefined) existing.title = title.trim()
    if (body !== undefined) existing.body = body.trim()
    if (status !== undefined && VALID_STATUSES.includes(status)) existing.status = status
    if (tags !== undefined) existing.tags = Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : existing.tags
    if (target_agent !== undefined && VALID_AGENTS.includes(target_agent)) existing.target_agent = target_agent
    if (artifact !== undefined) existing.artifact = artifact
    if (task_id !== undefined) existing.task_id = task_id

    existing.updated_at = new Date().toISOString()
    await writeFile(filePath, JSON.stringify(existing, null, 2))
    res.json(existing)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ideas/:id/decision — durable approval queue action
router.post('/:id/decision', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const decision = String(req.body?.decision || '').toLowerCase()
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : ''
    if (!APPROVAL_DECISIONS.has(decision)) {
      return res.status(400).json({ error: 'INVALID_DECISION', detail: `Unsupported decision: ${decision}` })
    }

    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    const existing = await safeReadJson(filePath)
    if (!existing) {
      return res.status(404).json({ error: 'idea not found' })
    }

    const currentApproval = normalizeApproval(existing)
    if (!currentApproval) {
      return res.status(409).json({ error: 'STALE_DECISION', detail: 'Idea no longer requires approval' })
    }
    if (currentApproval.state === 'routed' || currentApproval.state === 'routing_in_progress') {
      return res.status(409).json({ error: 'STALE_DECISION', detail: 'Idea already routed' })
    }

    const now = new Date().toISOString()
    existing.approval = {
      ...(existing.approval || {}),
      ...currentApproval,
      requested_at: currentApproval.requested_at,
      decided_at: now,
      decided_by: 'dashboard',
      decision_note: note || null,
      error: null,
    }

    if (decision === 'yes') {
      // Synchronously claim the in-process lock before any await.  Node.js is
      // single-threaded: no other handler can interleave between here and the
      // routingInFlight.add() call below, so exactly one concurrent Yes request
      // wins the claim and the rest get 409.
      if (routingInFlight.has(req.params.id)) {
        return res.status(409).json({ error: 'STALE_DECISION', detail: 'Idea already routed' })
      }
      routingInFlight.add(req.params.id)

      // Also persist routing_in_progress to disk before the external call so
      // a late stale-state reader (or a server restart mid-flight) sees the
      // lock rather than a spurious 'pending'.
      existing.approval = { ...existing.approval, state: 'routing_in_progress', error: null }
      existing.updated_at = now
      await writeFile(filePath, JSON.stringify(existing, null, 2))

      try {
        const taskId = await createApprovalTask(existing, currentApproval)
        existing.status = 'approved'
        existing.task_id = taskId
        existing.approval = {
          ...existing.approval,
          state: 'routed',
          task_id: taskId,
          next_action: `Track routed task ${taskId}`,
          error: null,
        }
        existing.updated_at = now
        await writeFile(filePath, JSON.stringify(existing, null, 2))
        routingInFlight.delete(req.params.id)
        try {
          await logTaskDecision(taskId, existing.id, note)
        } catch {
          // Routing truth is already persisted on the idea; task log failure is non-fatal here.
        }
        return res.json({ ok: true, approval_state: 'routed', task_id: taskId })
      } catch (err) {
        existing.approval = {
          ...existing.approval,
          state: 'routing_failed',
          task_id: null,
          next_action: 'Retry routing after the failure is resolved',
          error: String(err.message || err),
        }
        existing.updated_at = now
        await writeFile(filePath, JSON.stringify(existing, null, 2))
        routingInFlight.delete(req.params.id)
        return res.status(502).json({ error: 'ROUTING_FAILED', detail: String(err.message || err) })
      }
    }

    existing.approval = {
      ...existing.approval,
      state: APPROVAL_DECISIONS.get(decision),
      task_id: null,
      next_action: decision === 'later'
        ? 'Keep visible until revisited'
        : decision === 'no'
          ? 'Keep visible with rejection reason until resolved'
          : 'Keep visible until the idea is rescoped',
    }
    existing.updated_at = now
    await writeFile(filePath, JSON.stringify(existing, null, 2))

    res.json({ ok: true, approval_state: existing.approval.state })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/ideas/:id/approve — transition to approved, optionally create task
router.post('/:id/approve', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    const existing = await safeReadJson(filePath)
    if (!existing) {
      return res.status(404).json({ error: 'idea not found' })
    }

    existing.status = 'approved'
    existing.updated_at = new Date().toISOString()

    if (req.body.task_id) {
      existing.task_id = req.body.task_id
    }

    await writeFile(filePath, JSON.stringify(existing, null, 2))
    res.json(existing)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/ideas/:id — archive (soft delete)
router.delete('/:id', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    const existing = await safeReadJson(filePath)
    if (!existing) {
      return res.status(404).json({ error: 'idea not found' })
    }

    existing.status = 'archived'
    existing.updated_at = new Date().toISOString()
    await writeFile(filePath, JSON.stringify(existing, null, 2))
    res.json(existing)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

async function writeToMailbox(agentId, idea) {
  const dir = join(MAILBOXES_DIR, agentId, 'inbox')
  await mkdir(dir, { recursive: true })
  const envelope = {
    id: `brainstorm_${idea.id}`,
    from: 'sokrat',
    type: 'brainstorm_request',
    subject: `Brainstorm: ${idea.title}`,
    priority: 'P2',
    created_at: new Date().toISOString(),
    payload: { idea_id: idea.id, title: idea.title, body: idea.body },
  }
  await writeFile(join(dir, `${envelope.id}.json`), JSON.stringify(envelope, null, 2))
}

// POST /:id/brainstorm — trigger brainstorm agent
router.post('/:id/brainstorm', async (req, res) => {
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Idea not found' })
    const idea = JSON.parse(await readFile(filePath, 'utf-8'))
    if (idea.status !== 'draft') {
      return res.status(400).json({ error: `Cannot brainstorm: idea status is "${idea.status}", expected "draft"` })
    }
    const targetAgent = req.body.target_agent || idea.target_agent || 'brainstorm-claude'
    idea.status = 'brainstorming'
    idea.updated_at = new Date().toISOString()
    await writeFile(filePath, JSON.stringify(idea, null, 2))
    if (existsSync(SESSIONS_SEND)) {
      try {
        await new Promise((resolve, reject) => {
          execFile('node', [SESSIONS_SEND, targetAgent, JSON.stringify({ type: 'brainstorm_request', idea_id: idea.id })], { timeout: 30000 }, (err, _stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message)); else resolve()
          })
        })
      } catch { await writeToMailbox(targetAgent, idea) }
    } else {
      await writeToMailbox(targetAgent, idea)
    }
    res.status(202).json({ ok: true, status: 'brainstorming', idea_id: idea.id })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

// POST /:id/artifact — receive artifact from brainstorm agent
router.post('/:id/artifact', async (req, res) => {
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Idea not found' })
    const idea = JSON.parse(await readFile(filePath, 'utf-8'))
    const { artifact_md } = req.body
    if (!artifact_md || typeof artifact_md !== 'string') return res.status(400).json({ error: 'artifact_md is required' })
    idea.artifact_md = artifact_md
    idea.artifact_generated_at = new Date().toISOString()
    idea.status = 'artifact_ready'
    idea.updated_at = new Date().toISOString()
    await writeFile(filePath, JSON.stringify(idea, null, 2))
    res.json({ ok: true, status: 'artifact_ready', idea_id: idea.id })
  } catch (err) { res.status(500).json({ error: String(err) }) }
})

export default router
