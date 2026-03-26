import { Router } from 'express'
import { readFile, readdir, stat } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'

const router = Router()

const OPENCLAW_DIR = '/tmp/openclaw'
const TASKS_DIR = join(homedir(), 'clawd/tasks')

/**
 * Compute today's date string in Lisbon timezone (YYYY-MM-DD).
 */
function todayLisbon() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
}

/**
 * Read the last N lines from a file.
 */
async function tailFile(filePath, lines = 200) {
  try {
    const content = await readFile(filePath, 'utf-8')
    const allLines = content.split('\n').filter((l) => l.length > 0)
    return allLines.slice(-lines)
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

/**
 * Parse NDJSON file into array of objects.
 */
async function parseNdjson(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8')
    return content
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

/**
 * List subdirectories in a directory.
 */
async function listDirs(dirPath) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

// GET /api/logs/gateway?lines=200
router.get('/gateway', async (req, res) => {
  res.type('json') // ensure Content-Type: application/json even on error paths
  try {
    const lines = Math.min(Math.max(parseInt(req.query.lines) || 200, 1), 10000)
    const dateStr = todayLisbon()
    const logFile = join(OPENCLAW_DIR, `openclaw-${dateStr}.log`)

    const result = await tailFile(logFile, lines)
    if (result === null) {
      return res.json({ lines: [], file_size_bytes: 0, file_date: dateStr, error: 'Log file not found' })
    }

    let fileSize = 0
    try {
      const s = await stat(logFile)
      fileSize = s.size
    } catch {
      // ignore
    }

    res.json({ lines: result, file_size_bytes: fileSize, file_date: dateStr })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/logs/worker — list all .log files in /tmp/openclaw/
router.get('/worker', async (_req, res) => {
  try {
    let entries
    try {
      entries = await readdir(OPENCLAW_DIR)
    } catch (err) {
      if (err.code === 'ENOENT') return res.json({ files: [] })
      throw err
    }

    const logFiles = entries.filter((f) => f.endsWith('.log'))
    const files = await Promise.all(
      logFiles.map(async (name) => {
        try {
          const s = await stat(join(OPENCLAW_DIR, name))
          return { name, size_bytes: s.size }
        } catch {
          return { name, size_bytes: 0 }
        }
      })
    )

    res.json({ files })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/logs/worker/:name?lines=100
router.get('/worker/:name', async (req, res) => {
  try {
    const name = basename(req.params.name) // sanitize path traversal
    if (!name.endsWith('.log')) {
      return res.status(400).json({ error: 'Invalid log file name' })
    }

    const lines = Math.min(Math.max(parseInt(req.query.lines) || 100, 1), 10000)
    const logFile = join(OPENCLAW_DIR, name)

    const result = await tailFile(logFile, lines)
    if (result === null) {
      return res.status(404).json({ error: 'Log file not found' })
    }

    let fileSize = 0
    try {
      const s = await stat(logFile)
      fileSize = s.size
    } catch {
      // ignore
    }

    res.json({ lines: result, file_size_bytes: fileSize, file_name: name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Skip non-task dirs when iterating clawd/tasks
const NON_TASK_DIRS = new Set(['active', 'archive', 'config', 'metrics', 'templates'])

function isTaskDir(name) {
  return name.startsWith('tsk_') && !NON_TASK_DIRS.has(name)
}

// GET /api/decisions — aggregate decision-log.jsonl across all task dirs
router.get('/decisions', async (req, res) => {
  try {
    const taskDirs = (await listDirs(TASKS_DIR)).filter(isTaskDir)
    const allDecisions = []

    for (const dir of taskDirs) {
      const filePath = join(TASKS_DIR, dir, 'decision-log.jsonl')
      const entries = await parseNdjson(filePath)
      for (const entry of entries) {
        allDecisions.push({ ...entry, _task_dir: dir })
      }
    }

    // Filter by query params
    let filtered = allDecisions
    if (req.query.agent) {
      filtered = filtered.filter((d) => d.agent === req.query.agent)
    }
    if (req.query.task_id) {
      filtered = filtered.filter((d) => d.task_id === req.query.task_id)
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => {
      const ta = a.timestamp || a.ts || ''
      const tb = b.timestamp || b.ts || ''
      return tb.localeCompare(ta)
    })

    res.json(filtered)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/events — aggregate events.ndjson across all task dirs
router.get('/events', async (req, res) => {
  try {
    const taskDirs = (await listDirs(TASKS_DIR)).filter(isTaskDir)
    const allEvents = []

    for (const dir of taskDirs) {
      const filePath = join(TASKS_DIR, dir, 'events.ndjson')
      const entries = await parseNdjson(filePath)
      for (const entry of entries) {
        allEvents.push({ ...entry, _task_dir: dir })
      }
    }

    // Filter by query params
    let filtered = allEvents
    if (req.query.agent) {
      filtered = filtered.filter((e) => e.agent === req.query.agent || e.actor === req.query.agent)
    }
    if (req.query.task_id) {
      filtered = filtered.filter((e) => e.task_id === req.query.task_id)
    }
    if (req.query.type) {
      // match both 'type' and 'event_type' fields
      filtered = filtered.filter((e) => e.type === req.query.type || e.event_type === req.query.type)
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => {
      const ta = a.timestamp || a.ts || ''
      const tb = b.timestamp || b.ts || ''
      return tb.localeCompare(ta)
    })

    res.json(filtered)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
