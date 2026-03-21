import { Router } from 'express'
import { readFile, readdir } from 'fs/promises'
import { join, extname } from 'path'
import { homedir } from 'os'

const router = Router()

const KNOWN_FILES = ['MEMORY.md', 'AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md', 'HEARTBEAT.md', 'IDENTITY.md', 'BOOTSTRAP.md', 'SESSION-STATE.md', 'INBOX.md']
const DATE_RE = /^\d{4}-\d{2}-\d{2}\.md$/

function agentWorkspacePath(agent) {
  const home = homedir()
  if (agent === 'shared') {
    return join(home, '.openclaw', 'shared-memory')
  }
  return join(home, '.openclaw', `workspace-${agent}`)
}

/** GET /api/memory/:agent/files — list available memory files and daily note dates */
router.get('/:agent/files', async (req, res) => {
  try {
    const wsPath = agentWorkspacePath(req.params.agent)

    // List top-level known files
    const files = []
    for (const f of KNOWN_FILES) {
      try {
        await readFile(join(wsPath, f), 'utf-8')
        files.push(f)
      } catch {
        // file doesn't exist
      }
    }

    // Check for json files in workspace
    try {
      const entries = await readdir(wsPath)
      for (const e of entries) {
        if (e.endsWith('.json')) {
          files.push(e)
        }
      }
    } catch {
      // dir doesn't exist
    }

    // List daily notes from memory/ subdirectory
    const dailyDates = []
    try {
      const memDir = join(wsPath, 'memory')
      const memEntries = await readdir(memDir)
      for (const e of memEntries) {
        if (DATE_RE.test(e)) {
          dailyDates.push(e.replace('.md', ''))
        }
      }
    } catch {
      // no memory dir
    }

    res.json({ files, dailyDates })
  } catch (err) {
    console.error('[memory/files]', err)
    res.status(500).json({ error: 'failed to list files' })
  }
})

/** GET /api/memory/:agent/daily/:date — read daily note */
router.get('/:agent/daily/:date', async (req, res) => {
  try {
    const wsPath = agentWorkspacePath(req.params.agent)
    const filePath = join(wsPath, 'memory', `${req.params.date}.md`)
    const content = await readFile(filePath, 'utf-8')
    res.json({ content, type: 'markdown' })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.json({ content: null, error: 'not found' })
    }
    console.error('[memory/daily]', err)
    res.status(500).json({ error: 'failed to read daily note' })
  }
})

/** GET /api/memory/:agent/:file — read a specific memory file */
router.get('/:agent/:file', async (req, res) => {
  try {
    const wsPath = agentWorkspacePath(req.params.agent)
    const fileName = req.params.file
    const filePath = join(wsPath, fileName)

    // Prevent path traversal
    if (fileName.includes('..') || fileName.includes('/')) {
      return res.status(400).json({ error: 'invalid file name' })
    }

    const content = await readFile(filePath, 'utf-8')
    const ext = extname(fileName).toLowerCase()
    const type = ext === '.json' ? 'json' : 'markdown'

    res.json({ content, type })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.json({ content: null, error: 'not found' })
    }
    console.error('[memory/file]', err)
    res.status(500).json({ error: 'failed to read file' })
  }
})

export default router
