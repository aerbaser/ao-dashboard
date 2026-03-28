import { Router } from 'express'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

const router = Router()
const HOME = process.env.HOME || '/home/aiadmin'
const TODO_PATH = join(HOME, 'clawd/memory/tasks/TODO.md')
const TASKS_ACTIVE_DIR = join(HOME, 'clawd/tasks/active')

const SECTION_STATUS_MAP = {
  blocked: 'blocked',
  in_progress: 'in_progress',
  'in progress': 'in_progress',
  open_questions: 'open_questions',
  'open questions': 'open_questions',
  done: 'done',
  completed: 'done',
}

function sectionToStatus(title) {
  const lower = title.toLowerCase().replace(/[^a-z\s_]/g, '').trim()
  for (const [key, val] of Object.entries(SECTION_STATUS_MAP)) {
    if (lower.includes(key)) return val
  }
  return 'open'
}

function parseTodo(raw) {
  const lines = raw.split('\n')
  const items = []
  let currentSection = 'open'
  let counter = 1

  for (const line of lines) {
    // Section header: ## emoji Title
    const sectionMatch = line.match(/^##\s+(.+)$/)
    if (sectionMatch) {
      currentSection = sectionToStatus(sectionMatch[1])
      continue
    }

    // List item: - [x], - [ ], - [!]
    const itemMatch = line.match(/^-\s+\[([x !])\]\s+(.+)$/)
    if (!itemMatch) continue

    const checkbox = itemMatch[1]
    const rest = itemMatch[2]

    // Extract title from **bold** text
    const boldMatch = rest.match(/\*\*(.+?)\*\*/)
    const title = boldMatch ? boldMatch[1] : rest.trim()
    const description = rest.replace(/\*\*.+?\*\*/, '').trim() || null

    const status = checkbox === 'x' ? 'completed' : checkbox === '!' ? 'blocked' : 'pending'
    const id = `todo_${String(counter).padStart(3, '0')}`
    counter++

    items.push({ id, title, description, status, checkbox, section: currentSection })
  }

  return items
}

function parseYaml(raw) {
  const result = {}
  for (const line of raw.split('\n')) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      result[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  return result
}

// GET /api/pipeline
router.get('/', async (_req, res) => {
  try {
    const items = []

    // Read TODO.md
    try {
      const raw = await readFile(TODO_PATH, 'utf-8')
      items.push(...parseTodo(raw))
    } catch {
      // file may not exist
    }

    // Read active task YAML files
    try {
      const files = await readdir(TASKS_ACTIVE_DIR)
      for (const file of files) {
        if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue
        try {
          const raw = await readFile(join(TASKS_ACTIVE_DIR, file), 'utf-8')
          const parsed = parseYaml(raw)
          items.push({
            id: parsed.id ?? file.replace(/\.ya?ml$/, ''),
            title: parsed.title ?? file,
            status: parsed.status ?? 'pending',
            owner: parsed.owner ?? null,
            priority: parsed.priority ?? null,
            source: 'task-store',
          })
        } catch {
          // skip unparseable files
        }
      }
    } catch {
      // directory may not exist
    }

    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
