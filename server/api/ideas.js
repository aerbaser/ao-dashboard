// Ideas API — file-based CRUD + brainstorm dispatch
import { Router } from 'express'
import { readdir, readFile, writeFile, unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { randomBytes } from 'crypto'
import { execFile } from 'child_process'

const router = Router()
const HOME = process.env.HOME || '/home/aiadmin'
const IDEAS_DIR = join(HOME, 'clawd/ideas')
const MAILBOXES_DIR = join(HOME, 'clawd/runtime/mailboxes')
const SESSIONS_SEND = join(HOME, 'clawd/scripts/sessions-send.js')

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
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
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const rand = randomBytes(3).toString('hex')
  return `idea_${date}_${rand}`
}

async function loadIdea(id) {
  const files = await readdir(IDEAS_DIR).catch(() => [])
  const file = files.find(f => f.includes(id) && f.endsWith('.json'))
  if (!file) return null
  return safeReadJson(join(IDEAS_DIR, file))
}

async function saveIdea(idea) {
  await ensureDir(IDEAS_DIR)
  const file = `${idea.id}.json`
  await writeFile(join(IDEAS_DIR, file), JSON.stringify(idea, null, 2))
}

async function loadAllIdeas() {
  await ensureDir(IDEAS_DIR)
  const files = await readdir(IDEAS_DIR).catch(() => [])
  const ideas = []
  for (const f of files) {
    if (!f.endsWith('.json')) continue
    const idea = await safeReadJson(join(IDEAS_DIR, f))
    if (idea) ideas.push(idea)
  }
  // Sort by created_at descending (newest first)
  ideas.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  return ideas
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET / — list all ideas
router.get('/', async (_req, res) => {
  try {
    const ideas = await loadAllIdeas()
    res.json(ideas)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list ideas', detail: String(err) })
  }
})

// POST / — create idea
router.post('/', async (req, res) => {
  const { title, body, tags, target_agent, target_project } = req.body
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'title is required' })
  }

  const idea = {
    id: generateId(),
    title: title.trim(),
    body: (body || '').trim(),
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tags: Array.isArray(tags) ? tags : [],
    target_agent: target_agent || 'brainstorm-claude',
    target_project: target_project || null,
    artifact_md: null,
    artifact_generated_at: null,
    task_id: null,
    brainstorm_session_id: null,
  }

  try {
    await saveIdea(idea)
    res.status(201).json(idea)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create idea', detail: String(err) })
  }
})

// GET /:id — get single idea
router.get('/:id', async (req, res) => {
  try {
    const idea = await loadIdea(req.params.id)
    if (!idea) return res.status(404).json({ error: 'Idea not found' })
    res.json(idea)
  } catch (err) {
    res.status(500).json({ error: 'Failed to load idea', detail: String(err) })
  }
})

// PATCH /:id — update idea fields
router.patch('/:id', async (req, res) => {
  try {
    const idea = await loadIdea(req.params.id)
    if (!idea) return res.status(404).json({ error: 'Idea not found' })

    const allowed = ['title', 'body', 'tags', 'target_agent', 'target_project', 'status']
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        idea[key] = req.body[key]
      }
    }
    idea.updated_at = new Date().toISOString()

    await saveIdea(idea)
    res.json(idea)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update idea', detail: String(err) })
  }
})

// DELETE /:id — delete idea
router.delete('/:id', async (req, res) => {
  try {
    const files = await readdir(IDEAS_DIR).catch(() => [])
    const file = files.find(f => f.includes(req.params.id) && f.endsWith('.json'))
    if (!file) return res.status(404).json({ error: 'Idea not found' })

    await unlink(join(IDEAS_DIR, file))
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete idea', detail: String(err) })
  }
})

// POST /:id/brainstorm — trigger brainstorm agent
router.post('/:id/brainstorm', async (req, res) => {
  try {
    const idea = await loadIdea(req.params.id)
    if (!idea) return res.status(404).json({ error: 'Idea not found' })
    if (idea.status !== 'draft') {
      return res.status(400).json({ error: `Cannot brainstorm: idea status is "${idea.status}", expected "draft"` })
    }

    const targetAgent = req.body.target_agent || idea.target_agent || 'brainstorm-claude'

    // Update status to brainstorming
    idea.status = 'brainstorming'
    idea.updated_at = new Date().toISOString()
    await saveIdea(idea)

    // Dispatch to target agent via mailbox
    const message = JSON.stringify({
      type: 'brainstorm_request',
      idea_id: idea.id,
      title: idea.title,
      body: idea.body,
      callback_url: `/api/ideas/${idea.id}/artifact`,
      requested_at: new Date().toISOString(),
    })

    // Try sessions-send first, fall back to mailbox file write
    if (existsSync(SESSIONS_SEND)) {
      try {
        await new Promise((resolve, reject) => {
          execFile('node', [SESSIONS_SEND, targetAgent, message], { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message))
            else resolve(stdout)
          })
        })
      } catch {
        // Fall back to mailbox write
        await writeToMailbox(targetAgent, idea)
      }
    } else {
      await writeToMailbox(targetAgent, idea)
    }

    res.status(202).json({ ok: true, status: 'brainstorming', idea_id: idea.id })
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger brainstorm', detail: String(err) })
  }
})

// POST /:id/artifact — receive artifact from brainstorm agent (webhook callback)
router.post('/:id/artifact', async (req, res) => {
  try {
    const idea = await loadIdea(req.params.id)
    if (!idea) return res.status(404).json({ error: 'Idea not found' })

    const { artifact_md } = req.body
    if (!artifact_md || typeof artifact_md !== 'string') {
      return res.status(400).json({ error: 'artifact_md is required' })
    }

    idea.artifact_md = artifact_md
    idea.artifact_generated_at = new Date().toISOString()
    idea.status = 'artifact_ready'
    idea.updated_at = new Date().toISOString()

    await saveIdea(idea)
    res.json({ ok: true, status: 'artifact_ready', idea_id: idea.id })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save artifact', detail: String(err) })
  }
})

// POST /:id/archive — archive idea
router.post('/:id/archive', async (req, res) => {
  try {
    const idea = await loadIdea(req.params.id)
    if (!idea) return res.status(404).json({ error: 'Idea not found' })

    idea.status = 'archived'
    idea.updated_at = new Date().toISOString()
    await saveIdea(idea)
    res.json({ ok: true, status: 'archived' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive idea', detail: String(err) })
  }
})

// ─── Mailbox helper ──────────────────────────────────────────────────────────

async function writeToMailbox(agentId, idea) {
  const inboxDir = join(MAILBOXES_DIR, agentId, 'inbox')
  await ensureDir(inboxDir)

  const envelope = {
    id: `env_${Date.now()}_${randomBytes(3).toString('hex')}`,
    from: 'ao-dashboard',
    type: 'brainstorm_request',
    subject: `Brainstorm: ${idea.title}`,
    priority: 'normal',
    created_at: new Date().toISOString(),
    expires_at: null,
    payload: {
      idea_id: idea.id,
      title: idea.title,
      body: idea.body,
      callback_url: `/api/ideas/${idea.id}/artifact`,
    },
  }

  await writeFile(join(inboxDir, `${envelope.id}.json`), JSON.stringify(envelope, null, 2))
}

export default router
