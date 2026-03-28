import { Router } from 'express'
import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomBytes } from 'crypto'

const router = Router()
const HOME = process.env.HOME || '/home/aiadmin'
const IDEAS_DIR = join(HOME, 'clawd/ideas')

const VALID_STATUSES = ['draft', 'brainstorming', 'artifact_ready', 'approved', 'in_work', 'archived']
const VALID_AGENTS = ['brainstorm-claude', 'brainstorm-codex', 'sokrat']

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

export default router
