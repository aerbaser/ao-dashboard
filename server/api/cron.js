import { Router } from 'express'
import { execFile } from 'child_process'

const FIELD_LIMITS = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
]

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve({ stdout, stderr })
    })
    if (options.input) {
      child.stdin?.end(options.input)
    }
  })
}

function isEnvLine(line) {
  return /^[A-Z_][A-Z0-9_]*=/.test(line.trim())
}

function deriveCronLabel(command, comments) {
  const text = comments
    .map((line) => line.replace(/^#\s?/, '').trim())
    .filter(Boolean)
    .join(' / ')
  if (text) return text
  const match = command.match(/([\w-]+)(?:\.(?:sh|js|py))?(?:\s|$)/)
  return match?.[1]?.replace(/[-_]/g, ' ') ?? command
}

function classifyCronGroup(label, command) {
  const source = `${label} ${command}`.toLowerCase()
  if (source.includes('pipeline') || source.includes('mailbox') || source.includes('heartbeat') || source.includes('decision')) {
    return 'AO Pipeline'
  }
  if (source.includes('backup') || source.includes('cleanup') || source.includes('rotate') || source.includes('watchdog')) {
    return 'Maintenance'
  }
  if (source.includes('sync') || source.includes('langfuse') || source.includes('transcript')) {
    return 'Sync'
  }
  return 'Other'
}

function parseSimpleFieldPart(part, min, max) {
  if (part === '*') return true
  const stepMatch = part.match(/^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/)
  if (!stepMatch) return false
  const [, base, step] = stepMatch
  if (step && Number(step) <= 0) return false
  if (base === '*') return true
  if (base.includes('-')) {
    const [start, end] = base.split('-').map(Number)
    return start >= min && end <= max && start <= end
  }
  const value = Number(base)
  return value >= min && value <= max
}

function isValidCronField(field, min, max) {
  return field.split(',').every((part) => parseSimpleFieldPart(part.trim(), min, max))
}

export function isValidCronExpression(expression) {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return false
  return fields.every((field, index) => isValidCronField(field, FIELD_LIMITS[index][0], FIELD_LIMITS[index][1]))
}

function parseEntryLine(line, enabled, id, comments) {
  const match = line.match(/^\s*([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+(.+)$/)
  if (!match) return null

  const schedule = match.slice(1, 6).join(' ')
  if (!isValidCronExpression(schedule)) return null

  const command = match[6].trim()
  const label = deriveCronLabel(command, comments)
  return {
    id,
    schedule,
    command,
    enabled,
    label,
    group: classifyCronGroup(label, command),
  }
}

function parseCrontabDocument(raw) {
  const lines = raw.split(/\r?\n/)
  const blocks = []
  const entries = []
  let pendingComments = []

  const flushPendingComments = () => {
    for (const comment of pendingComments) {
      blocks.push({ type: 'raw', raw: comment })
    }
    pendingComments = []
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (!trimmed) {
      flushPendingComments()
      blocks.push({ type: 'raw', raw: line })
      return
    }

    if (isEnvLine(line)) {
      flushPendingComments()
      blocks.push({ type: 'raw', raw: line })
      return
    }

    if (trimmed.startsWith('#')) {
      const uncommented = trimmed.replace(/^#\s?/, '')
      const disabledEntry = parseEntryLine(uncommented, false, `entry-${index}`, pendingComments)
      if (disabledEntry) {
        blocks.push({ type: 'entry', id: disabledEntry.id, comments: pendingComments, entry: disabledEntry })
        entries.push(disabledEntry)
        pendingComments = []
        return
      }

      pendingComments.push(line)
      return
    }

    const activeEntry = parseEntryLine(line, true, `entry-${index}`, pendingComments)
    if (activeEntry) {
      blocks.push({ type: 'entry', id: activeEntry.id, comments: pendingComments, entry: activeEntry })
      entries.push(activeEntry)
      pendingComments = []
      return
    }

    flushPendingComments()
    blocks.push({ type: 'raw', raw: line })
  })

  flushPendingComments()

  return { entries, blocks }
}

export function parseCrontab(raw) {
  const { entries } = parseCrontabDocument(raw)
  return { entries }
}

function renderEntry(entry) {
  const commentLines = entry.label ? [`# ${entry.label}`] : []
  const line = `${entry.schedule} ${entry.command}`
  return [...commentLines, entry.enabled ? line : `# ${line}`]
}

function mergeCrontab(currentRaw, updatedEntries) {
  const { blocks } = parseCrontabDocument(currentRaw)
  const byId = new Map(updatedEntries.map((entry) => [entry.id, entry]))
  const lines = []

  for (const block of blocks) {
    if (block.type === 'raw') {
      lines.push(block.raw)
      continue
    }

    const updated = byId.get(block.id)
    if (!updated) continue
    lines.push(...renderEntry(updated))
  }

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`
}

export async function readCrontab() {
  try {
    const { stdout } = await execFileAsync('crontab', ['-l'], { timeout: 3000 })
    return stdout
  } catch {
    return ''
  }
}

export async function writeCrontab(contents) {
  await execFileAsync('crontab', ['-'], { timeout: 3000, input: contents })
}

export function createCronRouter(deps = {}) {
  const router = Router()
  const readCurrentCrontab = deps.readCrontab ?? readCrontab
  const writeCurrentCrontab = deps.writeCrontab ?? writeCrontab

  router.get('/', async (_req, res) => {
    try {
      const raw = await readCurrentCrontab()
      res.json(parseCrontab(raw))
    } catch (error) {
      res.status(500).json({ error: 'Failed to read crontab', detail: String(error) })
    }
  })

  router.post('/', async (req, res) => {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : null
    if (!entries) {
      res.status(400).json({ error: 'entries array is required' })
      return
    }

    for (const entry of entries) {
      if (!entry?.schedule || !isValidCronExpression(entry.schedule)) {
        res.status(400).json({ error: `Invalid cron expression: ${entry?.schedule ?? 'missing'}` })
        return
      }
      if (!entry?.command || typeof entry.command !== 'string') {
        res.status(400).json({ error: 'Cron command is required' })
        return
      }
    }

    try {
      const currentRaw = await readCurrentCrontab()
      const rendered = mergeCrontab(currentRaw, entries)
      await writeCurrentCrontab(rendered)
      res.json(parseCrontab(rendered))
    } catch (error) {
      res.status(500).json({ error: 'Failed to update crontab', detail: String(error) })
    }
  })

  return router
}

const router = createCronRouter()

export default router
