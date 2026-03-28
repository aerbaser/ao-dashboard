// Ideas API — CRUD for ~/clawd/ideas/ directory
import { Router } from 'express'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { execFile } from 'child_process'

const router = Router()

const VALID_ID_RE = /^idea_\d{8}_[a-f0-9]{6}$/

/** Validate idea :id param — prevents path traversal */
function validateId(req, res) {
  if (!VALID_ID_RE.test(req.params.id)) {
    res.status(400).json({ error: `Invalid idea id format: ${req.params.id}` })
    return false
  }
  return true
}

const IDEAS_DIR = join(process.env.HOME, 'clawd/ideas')
const TASK_STORE = join(process.env.HOME, 'clawd/scripts/task-store.js')
const COMM_DIR = join(
  process.env.HOME,
  '.openclaw/shared-memory/communication'
)

/** Ensure ideas directory exists. */
async function ensureDir() {
  if (!existsSync(IDEAS_DIR)) {
    await mkdir(IDEAS_DIR, { recursive: true })
  }
}

/** Read a single idea JSON file. */
async function readIdea(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

/** Write idea JSON to disk. */
async function writeIdea(idea) {
  await ensureDir()
  const filePath = join(IDEAS_DIR, `${idea.id}.json`)
  await writeFile(filePath, JSON.stringify(idea, null, 2), 'utf8')
}

/** Generate a unique idea ID. */
function makeId() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const r = Math.random().toString(36).slice(2, 8)
  return `idea_${d}_${r}`
}

/** Run task-store.js with args. */
function runTaskStore(args) {
  return new Promise((resolve, reject) => {
    execFile('node', [TASK_STORE, ...args], { timeout: 15_000 }, (err, stdout, stderr) => {
      if (err) reject({ stdout, stderr: stderr || err.message })
      else resolve({ stdout, stderr })
    })
  })
}

// ─── GET / — list all ideas ──────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    await ensureDir()
    const files = await readdir(IDEAS_DIR)
    const ideas = []
    for (const f of files) {
      if (!f.endsWith('.json')) continue
      try {
        ideas.push(await readIdea(join(IDEAS_DIR, f)))
      } catch { /* skip malformed */ }
    }
    ideas.sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
    res.json(ideas)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list ideas', detail: String(err) })
  }
})

// ─── POST / — create idea ───────────────────────────────────────────────────

router.post('/', async (req, res) => {
  try {
    const { title, body, target_agent, target_project, tags } = req.body
    if (!title) return res.status(400).json({ error: 'title is required' })
    const now = new Date().toISOString()
    const idea = {
      id: makeId(),
      title,
      body: body || '',
      status: 'draft',
      created_at: now,
      updated_at: now,
      tags: tags || [],
      target_agent: target_agent || 'brainstorm-claude',
      target_project: target_project || '',
      artifact_md: null,
      artifact_generated_at: null,
      task_id: null,
      brainstorm_session_id: null,
    }
    await writeIdea(idea)
    res.status(201).json(idea)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create idea', detail: String(err) })
  }
})

// ─── GET /:id — get single idea ─────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Idea not found' })
    const idea = await readIdea(filePath)
    res.json(idea)
  } catch (err) {
    res.status(500).json({ error: 'Failed to read idea', detail: String(err) })
  }
})

// ─── PATCH /:id — update idea fields ────────────────────────────────────────

router.patch('/:id', async (req, res) => {
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Idea not found' })
    const idea = await readIdea(filePath)
    const allowed = ['title', 'body', 'tags', 'status', 'artifact_md']
    for (const key of allowed) {
      if (req.body[key] !== undefined) idea[key] = req.body[key]
    }
    idea.updated_at = new Date().toISOString()
    await writeIdea(idea)
    res.json(idea)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update idea', detail: String(err) })
  }
})

// ─── POST /:id/brainstorm — trigger brainstorm agent ────────────────────────

router.post('/:id/brainstorm', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Idea not found' })
    const idea = await readIdea(filePath)

    // Write brainstorm request to agent inbox
    const inboxPath = join(COMM_DIR, `inbox_${idea.target_agent || 'brainstorm-claude'}.md`)
    await mkdir(join(COMM_DIR), { recursive: true })
    const msg = `## [IDEA-BRAINSTORM] ${idea.id}\n\n**Title:** ${idea.title}\n**Body:** ${idea.body}\n**Context:** ${(idea.tags || []).join(', ')}, ${idea.target_project || 'unspecified'}\n\nProduce: design doc / brainstorm artifact.\nWrite result to: ~/clawd/ideas/${idea.id}.json field artifact_md.\nUpdate status to artifact_ready.\n`
    const { appendFile } = await import('fs/promises')
    await appendFile(inboxPath, '\n---\n' + msg, 'utf8')

    idea.status = 'brainstorming'
    idea.updated_at = new Date().toISOString()
    await writeIdea(idea)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger brainstorm', detail: String(err) })
  }
})

// ─── POST /:id/approve — create task from idea ─────────────────────────────

router.post('/:id/approve', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Idea not found' })
    const idea = await readIdea(filePath)

    if (!idea.artifact_md) {
      return res.status(400).json({ error: 'Cannot approve idea without artifact' })
    }

    // Create task via task-store.js
    const result = await runTaskStore([
      'create',
      '--title', idea.title,
      '--route', 'artifact_route',
      '--outcome-type', 'strategy_doc',
    ])

    // Parse task_id from stdout (task-store.js outputs JSON or task_id line)
    let taskId
    try {
      const parsed = JSON.parse(result.stdout)
      taskId = parsed.task_id || parsed.id
    } catch {
      // Fallback: extract tsk_xxx from output
      const match = result.stdout.match(/tsk_\w+/)
      taskId = match ? match[0] : null
    }

    if (!taskId) {
      return res.status(500).json({ error: 'Task created but could not parse task_id', stdout: result.stdout })
    }

    // Write decomposition request to Platon inbox
    const platonInbox = join(COMM_DIR, 'inbox_platon.md')
    await mkdir(join(COMM_DIR), { recursive: true })
    const { appendFile } = await import('fs/promises')
    const decompMsg = `## [DECOMPOSITION-REQUEST] ${taskId}\n\nIdea: ${idea.id}\nTitle: ${idea.title}\nArtifact: available in ~/clawd/ideas/${idea.id}.json\n\nPlease decompose this into subtasks.\n`
    await appendFile(platonInbox, '\n---\n' + decompMsg, 'utf8')

    // Update idea
    idea.status = 'in_work'
    idea.task_id = taskId
    idea.updated_at = new Date().toISOString()
    await writeIdea(idea)

    res.json({ ok: true, task_id: taskId })
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve idea', detail: String(err) })
  }
})

// ─── POST /:id/archive — archive idea ──────────────────────────────────────

router.post('/:id/archive', async (req, res) => {
  if (!validateId(req, res)) return
  try {
    const filePath = join(IDEAS_DIR, `${req.params.id}.json`)
    if (!existsSync(filePath)) return res.status(404).json({ error: 'Idea not found' })
    const idea = await readIdea(filePath)
    idea.status = 'archived'
    idea.updated_at = new Date().toISOString()
    await writeIdea(idea)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive idea', detail: String(err) })
  }
})

export default router
