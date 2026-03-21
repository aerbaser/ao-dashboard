import { Router } from 'express'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const router = Router()

const SECRETS_RE = /token|key|secret|password|bearer|auth/i

/** Recursively redact values whose key matches the secrets pattern */
function redactSecrets(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(redactSecrets)

  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (SECRETS_RE.test(k) && typeof v === 'string') {
      out[k] = '••••••••'
    } else if (typeof v === 'object' && v !== null) {
      out[k] = redactSecrets(v)
    } else {
      out[k] = v
    }
  }
  return out
}

/** GET /api/config/gateway — structured openclaw.json with secrets redacted */
router.get('/gateway', async (_req, res) => {
  try {
    const configPath = join(homedir(), '.openclaw', 'openclaw.json')
    const raw = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(raw)
    res.json(redactSecrets(parsed))
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.json({ content: null, error: 'not found' })
    }
    console.error('[config/gateway]', err)
    res.status(500).json({ error: 'failed to read config' })
  }
})

/** GET /api/config/team-manifest — raw markdown content */
router.get('/team-manifest', async (_req, res) => {
  try {
    const manifestPath = join(homedir(), '.openclaw', 'shared-memory', 'team-manifest.md')
    const content = await readFile(manifestPath, 'utf-8')
    res.json({ content })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.json({ content: null, error: 'not found' })
    }
    console.error('[config/team-manifest]', err)
    res.status(500).json({ error: 'failed to read team manifest' })
  }
})

export default router
