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

const VALID_STATUSES = ['draft', 'brainstorming', 'artifact_ready', 'pending_approval', 'approved', 'in_work', 'archived']
const VALID_DECISION_ACTIONS = ['yes', 'later', 'no', 'rescope']
const VALID_AGENTS = ['brainstorm-claude', 'brainstorm-codex', 'sokrat']
const VALID_ID_RE = /^idea_\d{8}_[a-f0-9]{6}$/

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
    existing.pending_since = null

    if (req.body.task_id) {
      existing.task_id = req.body.task_id
    }

    await writeFile(filePath, JSON.stringify(existing, null, 2))
    res.json(existing)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/ideas/:id/submit-for-approval — transition artifact_ready → pending_approval
router.post('/:id/submit-for-approval', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    const existing = await safeReadJson(filePath)
    if (!existing) {
      return res.status(404).json({ error: 'idea not found' })
    }

    if (existing.status !== 'artifact_ready') {
      return res.status(400).json({ error: `Cannot submit for approval: status is "${existing.status}", expected "artifact_ready"` })
    }

    const now = new Date().toISOString()
    existing.status = 'pending_approval'
    existing.pending_since = now
    existing.updated_at = now

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

// POST /api/ideas/:id/decision — record an approval decision (yes/later/no/rescope)
router.post('/:id/decision', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    const existing = await safeReadJson(filePath)
    if (!existing) {
      return res.status(404).json({ error: 'idea not found' })
    }

    if (existing.status !== 'pending_approval') {
      return res.status(409).json({
        error: 'STALE_STATE',
        message: `Idea is "${existing.status}", not pending_approval — it may have been resolved elsewhere`,
        current_status: existing.status,
      })
    }

    const { action, reason } = req.body
    if (!action || !VALID_DECISION_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `Invalid action: ${action}. Must be one of: ${VALID_DECISION_ACTIONS.join(', ')}` })
    }

    const now = new Date().toISOString()
    const decision = {
      action,
      actor: 'platon',
      timestamp: now,
      reason: reason || undefined,
    }

    // Append to decisions log
    if (!Array.isArray(existing.approval_decisions)) {
      existing.approval_decisions = []
    }
    existing.approval_decisions.push(decision)
    existing.updated_at = now

    // Transition based on action
    switch (action) {
      case 'yes':
        existing.status = 'approved'
        break
      case 'later':
        // Stay pending_approval — no status change
        break
      case 'no':
        existing.status = 'archived'
        break
      case 'rescope':
        existing.status = 'draft'
        existing.pending_since = null
        break
    }

    await writeFile(filePath, JSON.stringify(existing, null, 2))
    res.json({ ok: true, idea: existing, decision })
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
