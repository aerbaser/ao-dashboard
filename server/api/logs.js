import { Router } from 'express'
import { readFile, readdir, realpath, stat } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'

const router = Router()

const OPENCLAW_DIR = '/tmp/openclaw'
const TASKS_ROOT_DIR = join(homedir(), 'clawd/tasks')
const ACTIVE_TASKS_DIR = join(TASKS_ROOT_DIR, 'active')

/**
 * Compute today's date string in Lisbon timezone (YYYY-MM-DD).
 */
function todayLisbon(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
}

function readLineCount(value, fallback = 200) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, 1), 10000)
}

/**
 * Read the last N lines from a file.
 */
async function tailFile(filePath, lines = 200) {
  try {
    const content = await readFile(filePath, 'utf-8')
    const allLines = content.split('\n').filter((line) => line.length > 0)
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
      .filter((line) => line.trim().length > 0)
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
async function listDirs(dirPath, pattern = /^tsk_/) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && pattern.test(entry.name))
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

async function resolveTaskDirs() {
  const discovered = await Promise.all([
    listDirs(ACTIVE_TASKS_DIR),
    listDirs(TASKS_ROOT_DIR),
  ])

  const paths = [
    ...discovered[0].map((name) => join(ACTIVE_TASKS_DIR, name)),
    ...discovered[1].map((name) => join(TASKS_ROOT_DIR, name)),
  ]

  const deduped = new Map()
  for (const path of paths) {
    try {
      deduped.set(await realpath(path), true)
    } catch {
      deduped.set(path, true)
    }
  }

  return Array.from(deduped.keys()).sort()
}

function asText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function decisionResult(entry) {
  const explicit = [entry.result, entry.outcome, entry.status]
    .map((value) => asText(value).toUpperCase())
    .find((value) => ['PASS', 'FAIL', 'DELEGATED'].includes(value))
  if (explicit) return explicit

  const values = [
    entry.decision_type,
    entry.resolution_mode,
    entry.chosen,
    entry.summary,
  ].map((value) => asText(value).toUpperCase())

  if (values.some((value) => value.includes('DELEGAT'))) return 'DELEGATED'
  if (values.some((value) => /(FAIL|REJECT|DENY|BLOCK|ERROR)/.test(value))) return 'FAIL'

  const resolved = [
    entry.resolution_mode,
    entry.resolved_at,
    entry.resolved_by,
    entry.actor,
    entry.summary,
    entry.chosen,
  ].some(Boolean)

  return resolved ? 'PASS' : ''
}

function normalizeDecision(entry, taskDir) {
  return {
    ...entry,
    agent: asText(entry.agent) || asText(entry.resolved_by) || asText(entry.actor) || 'unknown',
    task_id: asText(entry.task_id) || basename(taskDir),
    gate_type: asText(entry.gate_type) || asText(entry.gate) || asText(entry.decision_type) || 'unknown',
    result: decisionResult(entry),
    timestamp: asText(entry.timestamp) || asText(entry.resolved_at) || asText(entry.ts),
    _task_dir: basename(taskDir),
  }
}

function normalizeEvent(entry, taskDir) {
  const type = asText(entry.type) || asText(entry.event_type) || 'UNKNOWN'

  return {
    ...entry,
    type: type.toUpperCase(),
    actor: asText(entry.actor) || asText(entry.agent) || 'system',
    task_id: asText(entry.task_id) || basename(taskDir),
    timestamp: asText(entry.timestamp) || asText(entry.ts),
    _task_dir: basename(taskDir),
  }
}

async function collectTaskFileEntries(fileName, normalizeEntry) {
  const taskDirs = await resolveTaskDirs()
  const entries = []

  for (const taskDir of taskDirs) {
    const fileEntries = await parseNdjson(join(taskDir, fileName))
    for (const entry of fileEntries) {
      entries.push(normalizeEntry(entry, taskDir))
    }
  }

  return entries
}

function sortNewestFirst(items) {
  return [...items].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

// GET /api/logs/gateway?lines=200
router.get('/gateway', async (req, res) => {
  try {
    const lines = readLineCount(req.query.lines, 200)
    const dateStr = todayLisbon()
    const logFile = join(OPENCLAW_DIR, `openclaw-${dateStr}.log`)

    const result = await tailFile(logFile, lines)
    if (result === null) {
      return res.json({
        lines: [],
        file_size_bytes: 0,
        file_date: dateStr,
        error: 'Log file not found',
      })
    }

    let fileSize = 0
    try {
      fileSize = (await stat(logFile)).size
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
          return { name, size_bytes: (await stat(join(OPENCLAW_DIR, name))).size }
        } catch {
          return { name, size_bytes: 0 }
        }
      })
    )

    res.json({
      files: files.sort((left, right) => left.name.localeCompare(right.name)),
    })
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

    const lines = readLineCount(req.query.lines, 100)
    const logFile = join(OPENCLAW_DIR, name)

    const result = await tailFile(logFile, lines)
    if (result === null) {
      return res.status(404).json({ error: 'Log file not found' })
    }

    let fileSize = 0
    try {
      fileSize = (await stat(logFile)).size
    } catch {
      // ignore
    }

    res.json({ lines: result, file_size_bytes: fileSize, file_name: name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/decisions — aggregate decision-log.jsonl across all task dirs
router.get('/decisions', async (req, res) => {
  try {
    const allDecisions = await collectTaskFileEntries('decision-log.jsonl', normalizeDecision)

    let filtered = allDecisions
    if (req.query.agent) {
      filtered = filtered.filter((d) => d.agent === req.query.agent)
    }
    if (req.query.task_id) {
      filtered = filtered.filter((d) => d.task_id.includes(String(req.query.task_id)))
    }
    if (req.query.from) {
      filtered = filtered.filter((d) => d.timestamp >= String(req.query.from))
    }
    if (req.query.to) {
      filtered = filtered.filter((d) => d.timestamp <= String(req.query.to))
    }

    res.json(sortNewestFirst(filtered))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/events — aggregate events.ndjson across all task dirs
router.get('/events', async (req, res) => {
  try {
    const allEvents = await collectTaskFileEntries('events.ndjson', normalizeEvent)

    let filtered = allEvents
    if (req.query.agent) {
      filtered = filtered.filter((e) => e.actor === req.query.agent || e.agent === req.query.agent)
    }
    if (req.query.task_id) {
      filtered = filtered.filter((e) => e.task_id.includes(String(req.query.task_id)))
    }
    if (req.query.type) {
      filtered = filtered.filter((e) => e.type === String(req.query.type).toUpperCase())
    }

    res.json(sortNewestFirst(filtered))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
