import { Router } from 'express'
import { readdir, readFile, writeFile, copyFile, unlink, rename, mkdir } from 'fs/promises'
import { join } from 'path'
import { execFile } from 'child_process'
import { existsSync } from 'fs'

const router = Router()
const HOME = process.env.HOME || '/home/aiadmin'

const HEARTBEATS_DIR = join(HOME, 'clawd/runtime/heartbeats')
const MAILBOXES_DIR = join(HOME, 'clawd/runtime/mailboxes')
const COMM_DIR = join(HOME, '.openclaw/shared-memory/communication')
const SESSIONS_SEND = join(HOME, 'clawd/scripts/sessions-send.js')
const WEBHOOKS_FILE = join(HOME, 'clawd/runtime/agent-webhooks.json')
const OPENCLAW_JSON = join(HOME, '.openclaw/openclaw.json')

const AGENT_META = [
  { id: 'sokrat',           name: 'Сократ',           emoji: '🦉', role: 'Orchestrator' },
  { id: 'archimedes',       name: 'Архимед',          emoji: '🔧', role: 'Engineer' },
  { id: 'aristotle',        name: 'Аристотель',       emoji: '📚', role: 'Researcher' },
  { id: 'herodotus',        name: 'Геродот',          emoji: '📜', role: 'Chronicler' },
  { id: 'platon',           name: 'Платон',           emoji: '🏛️', role: 'Architect' },
  { id: 'hephaestus',       name: 'Гефест',           emoji: '⚒️', role: 'Infrastructure' },
  { id: 'brainstorm-claude', name: 'Brainstorm Claude', emoji: '🧠', role: 'Brainstorm' },
  { id: 'brainstorm-codex', name: 'Brainstorm Codex',  emoji: '💡', role: 'Brainstorm' },
  { id: 'leo',              name: 'Лео',              emoji: '🎨', role: 'Designer' },
]

const VALID_FOLDERS = ['inbox', 'processing', 'done', 'deadletter']

async function safeReadJson(filePath) {
  try {
    const raw = await readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function countFiles(dirPath) {
  try {
    const files = await readdir(dirPath)
    return files.filter(f => f.endsWith('.json')).length
  } catch {
    return 0
  }
}

function deriveStatus(heartbeat) {
  if (!heartbeat) return 'unknown'
  const state = heartbeat.state
  if (state === 'active' || state === 'working' || state === 'running') return 'active'
  if (state === 'idle') return 'idle'
  if (state === 'waiting') return 'waiting'
  if (state === 'dead' || state === 'error') return 'dead'

  // Check age — if no heartbeat for 10+ minutes, consider dead
  if (heartbeat.updated_at) {
    const age = Date.now() - new Date(heartbeat.updated_at).getTime()
    if (age > 10 * 60 * 1000) return 'idle'
  }
  return 'idle'
}

// GET /api/agents — list all agents with heartbeat + mailbox counts
router.get('/', async (_req, res) => {
  try {
    const configIdFor = (id) => id === 'sokrat' ? 'main' : id
    const openclawConfig = await safeReadJson(OPENCLAW_JSON)
    const agentConfigList = openclawConfig?.agents?.list ?? []

    const agents = await Promise.all(
      AGENT_META.map(async (meta) => {
        const heartbeat = await safeReadJson(join(HEARTBEATS_DIR, `${meta.id}.json`))
        const mailbox = {
          inbox:      await countFiles(join(MAILBOXES_DIR, meta.id, 'inbox')),
          processing: await countFiles(join(MAILBOXES_DIR, meta.id, 'processing')),
          done:       await countFiles(join(MAILBOXES_DIR, meta.id, 'done')),
          deadletter: await countFiles(join(MAILBOXES_DIR, meta.id, 'deadletter')),
        }
        const agentConfig = agentConfigList.find(a => a.id === configIdFor(meta.id))

        return {
          id: meta.id,
          name: meta.name,
          emoji: meta.emoji,
          role: meta.role,
          status: deriveStatus(heartbeat),
          current_task_id: heartbeat?.current_task_id ?? null,
          current_step: heartbeat?.current_step ?? null,
          progress_note: heartbeat?.progress_note ?? null,
          checkpoint_safe: heartbeat?.checkpoint_safe ?? null,
          last_seen: heartbeat?.updated_at ?? null,
          mailbox,
          skills: agentConfig?.skills ?? [],
          model: agentConfig?.model?.primary ?? null,
        }
      })
    )
    res.json(agents)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/agents/:id/mailbox/:folder — list envelopes in folder
router.get('/:id/mailbox/:folder', async (req, res) => {
  const { id, folder } = req.params
  if (!VALID_FOLDERS.includes(folder)) {
    return res.status(400).json({ error: `Invalid folder: ${folder}` })
  }

  const dir = join(MAILBOXES_DIR, id, folder)
  try {
    const files = await readdir(dir).catch(() => [])
    const envelopes = await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async (file) => {
        const data = await safeReadJson(join(dir, file))
        if (!data) return null
        return {
          id: file.replace('.json', ''),
          from: data.from ?? 'unknown',
          type: data.type ?? 'unknown',
          subject: data.subject ?? data.title ?? '(no subject)',
          priority: data.priority ?? 'P2',
          created_at: data.created_at ?? data.timestamp ?? '',
          expires_at: data.expires_at ?? null,
          payload: data.payload ?? data.body ?? null,
        }
      })
    )
    res.json(envelopes.filter(Boolean))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/agents/:id/inbox-md — INBOX.md rendered content
router.get('/:id/inbox-md', async (req, res) => {
  const { id } = req.params
  const filePath = join(COMM_DIR, `inbox_${id}.md`)
  try {
    const content = await readFile(filePath, 'utf-8')
    res.json({ content })
  } catch {
    res.json({ content: '' })
  }
})

// GET /api/agents/:id/log — communication log
router.get('/:id/log', async (req, res) => {
  const { id } = req.params
  const filePath = join(COMM_DIR, `log_${id}.md`)
  try {
    const content = await readFile(filePath, 'utf-8')
    res.json({ content })
  } catch {
    res.json({ content: '' })
  }
})

// POST /api/agents/:id/message — send message via sessions-send.js
router.post('/:id/message', async (req, res) => {
  const { id } = req.params
  const { message } = req.body

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, error: 'message is required' })
  }

  if (!existsSync(SESSIONS_SEND)) {
    return res.status(501).json({ ok: false, error: 'sessions-send.js not found' })
  }

  try {
    await new Promise((resolve, reject) => {
      execFile('node', [SESSIONS_SEND, id, message], { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message))
        else resolve(stdout)
      })
    })
    res.json({ ok: true })
  } catch (err) {
    res.json({ ok: false, error: err.message })
  }
})

// POST /api/agents/:id/wake — wake agent via webhook
router.post('/:id/wake', async (req, res) => {
  const { id } = req.params

  try {
    let webhooks = null
    if (existsSync(WEBHOOKS_FILE)) {
      webhooks = await safeReadJson(WEBHOOKS_FILE)
    }

    const url = webhooks?.[id] ?? process.env[`AGENT_WAKE_${id.toUpperCase().replace(/-/g, '_')}`]
    if (!url) {
      return res.status(501).json({ ok: false, error: `No wake webhook configured for ${id}` })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: id, action: 'wake' }),
    })

    if (!response.ok) {
      return res.json({ ok: false, error: `Webhook returned ${response.status}` })
    }

    res.json({ ok: true })
  } catch (err) {
    res.json({ ok: false, error: err.message })
  }
})

// DELETE /api/agents/:id/mailbox/:folder/:envelopeId — delete envelope
router.delete('/:id/mailbox/:folder/:envelopeId', async (req, res) => {
  const { id, folder, envelopeId } = req.params
  if (!VALID_FOLDERS.includes(folder)) {
    return res.status(400).json({ ok: false, error: `Invalid folder: ${folder}` })
  }

  const filePath = join(MAILBOXES_DIR, id, folder, `${envelopeId}.json`)
  try {
    await unlink(filePath)
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ ok: false, error: 'Envelope not found' })
    }
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/agents/:id/mailbox/:folder/:envelopeId/move — move envelope to another folder
router.post('/:id/mailbox/:folder/:envelopeId/move', async (req, res) => {
  const { id, folder, envelopeId } = req.params
  const { to } = req.body

  if (!VALID_FOLDERS.includes(folder) || !VALID_FOLDERS.includes(to)) {
    return res.status(400).json({ ok: false, error: 'Invalid folder' })
  }

  const src = join(MAILBOXES_DIR, id, folder, `${envelopeId}.json`)
  const destDir = join(MAILBOXES_DIR, id, to)
  const dest = join(destDir, `${envelopeId}.json`)

  try {
    await mkdir(destDir, { recursive: true })
    await rename(src, dest)
    res.json({ ok: true })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ ok: false, error: 'Envelope not found' })
    }
    res.status(500).json({ ok: false, error: err.message })
  }
})

const ALLOWED_FILES = [
  'AGENTS.md', 'SOUL.md', 'TOOLS.md', 'IDENTITY.md', 'USER.md',
  'MEMORY.md', 'HEARTBEAT.md', 'BOOTSTRAP.md', 'INBOX.md',
]

// GET /api/agents/:id/files/:filename — read a workspace file
router.get('/:id/files/:filename', async (req, res) => {
  const { id, filename } = req.params
  if (filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  if (!ALLOWED_FILES.includes(filename)) {
    return res.status(400).json({ error: `File not allowed: ${filename}` })
  }
  const heartbeat = await safeReadJson(join(HEARTBEATS_DIR, `${id}.json`))
  if (!heartbeat) {
    return res.status(404).json({ error: `Agent '${id}' not found` })
  }
  const workspacePath = heartbeat.workspace_path ?? join(HOME, '.openclaw', `workspace-${id}`)
  try {
    const content = await readFile(join(workspacePath, filename), 'utf-8')
    res.json({ content, filename })
  } catch {
    res.json({ content: '', filename })
  }
})

// PUT /api/agents/:id/files/:filename — write a workspace file
router.put('/:id/files/:filename', async (req, res) => {
  const { id, filename } = req.params
  if (filename.includes('..')) {
    return res.status(400).json({ ok: false, error: 'Invalid filename' })
  }
  if (!ALLOWED_FILES.includes(filename)) {
    return res.status(400).json({ ok: false, error: `File not allowed: ${filename}` })
  }
  const { content } = req.body
  if (typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' })
  }
  const heartbeat = await safeReadJson(join(HEARTBEATS_DIR, `${id}.json`))
  if (!heartbeat) {
    return res.status(404).json({ error: `Agent '${id}' not found` })
  }
  const workspacePath = heartbeat.workspace_path ?? join(HOME, '.openclaw', `workspace-${id}`)
  await writeFile(join(workspacePath, filename), content, 'utf-8')
  res.json({ ok: true })
})

// GET /api/agents/:id/skills — get agent's active skills from openclaw.json
router.get('/:id/skills', async (req, res) => {
  const { id } = req.params
  try {
    const raw = await readFile(OPENCLAW_JSON, 'utf-8')
    const config = JSON.parse(raw)
    const agentList = config?.agents?.list || []
    const agent = agentList.find(a => a.id === id)
    if (!agent) {
      return res.status(404).json({ error: `Agent '${id}' not found in openclaw.json` })
    }
    res.json({ skills: agent.skills || [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/agents/:id/skills — update agent skills in openclaw.json
router.put('/:id/skills', async (req, res) => {
  const { id } = req.params
  const { skills } = req.body

  if (!Array.isArray(skills)) {
    return res.status(400).json({ ok: false, error: 'skills must be an array' })
  }
  if (skills.length === 0) {
    return res.status(400).json({ ok: false, error: 'skills array must not be empty' })
  }
  // Validate all entries are non-empty strings
  if (!skills.every(s => typeof s === 'string' && s.trim().length > 0)) {
    return res.status(400).json({ ok: false, error: 'all skills must be non-empty strings' })
  }

  try {
    const raw = await readFile(OPENCLAW_JSON, 'utf-8')
    const config = JSON.parse(raw)
    const agentList = config?.agents?.list || []
    const agentIdx = agentList.findIndex(a => a.id === id)
    if (agentIdx === -1) {
      return res.status(404).json({ ok: false, error: `Agent '${id}' not found in openclaw.json` })
    }

    const dedupedSkills = [...new Set(skills.map(s => s.trim()))]
    config.agents.list[agentIdx].skills = dedupedSkills

    await writeFile(OPENCLAW_JSON, JSON.stringify(config, null, 2) + '\n', 'utf-8')
    res.json({ ok: true, skills: dedupedSkills })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/agents/:id/model — change agent primary model in openclaw.json
router.post("/:id/model", async (req, res) => {
  const { id } = req.params
  const { model } = req.body
  if (!model || typeof model !== "string") {
    return res.status(400).json({ ok: false, error: "model is required" })
  }
  const agent = AGENT_META.find((a) => a.id === id)
  if (!agent) {
    return res.status(404).json({ ok: false, error: `Unknown agent: ${id}` })
  }
  try {
    const raw = await readFile(OPENCLAW_JSON, "utf-8")
    const config = JSON.parse(raw)
    const configId = id === "sokrat" ? "main" : id
    const agentList = config?.agents?.list ?? []
    const agentIdx = agentList.findIndex((a) => a.id === configId)
    if (agentIdx === -1) {
      return res.status(404).json({ ok: false, error: `Agent ${id} not found in openclaw.json` })
    }
    await copyFile(OPENCLAW_JSON, `${OPENCLAW_JSON}.bak`)
    const agentEntry = config.agents.list[agentIdx]
    if (!agentEntry.model || typeof agentEntry.model === "string") {
      agentEntry.model = { primary: model }
    } else {
      agentEntry.model.primary = model
    }
    await writeFile(OPENCLAW_JSON, JSON.stringify(config, null, 2) + "\n", "utf-8")
    execFile("openclaw", ["gateway", "restart"], { timeout: 60000 }, (err) => {
      if (err) console.error("[agents] gateway restart failed:", err.message)
    })
    res.json({ ok: true, restarting: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

export default router
