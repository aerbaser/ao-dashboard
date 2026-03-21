// Rate-limits API — reads gateway cache, supports profile switching.
// Cache file written by openclaw gateway plugin on each API call.
import { Router } from 'express'
import { readFile, writeFile, stat, mkdir } from 'fs/promises'
import { join } from 'path'

const router = Router()

const RUNTIME_DIR = join(process.env.HOME ?? '', 'clawd/runtime')
const CACHE_FILE = join(RUNTIME_DIR, 'rate-limit-cache.json')
const PROFILE_FILE = join(RUNTIME_DIR, 'active-profile.json')

const STALE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

/**
 * GET /api/rate-limits
 * Returns profiles array from cache file. Gracefully handles missing/stale.
 */
router.get('/', async (_req, res) => {
  try {
    const fileStat = await stat(CACHE_FILE).catch(() => null)

    if (!fileStat) {
      return res.json({ cached: false, stale: true, profiles: [] })
    }

    const ageMs = Date.now() - fileStat.mtimeMs
    const stale = ageMs > STALE_THRESHOLD_MS
    const raw = await readFile(CACHE_FILE, 'utf8')
    const data = JSON.parse(raw)
    const profiles = Array.isArray(data.profiles) ? data.profiles : []

    return res.json({ cached: true, stale, profiles })
  } catch {
    // Never throw 500 — return safe fallback
    return res.json({ cached: false, stale: true, profiles: [] })
  }
})

/**
 * POST /api/rate-limits/switch
 * Accepts { to: "yura" | "dima" }, writes active-profile.json.
 */
router.post('/switch', async (req, res) => {
  const { to } = req.body ?? {}

  if (!to || typeof to !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing "to" field' })
  }

  try {
    await mkdir(RUNTIME_DIR, { recursive: true })
    const payload = {
      active: to,
      updated_at: new Date().toISOString(),
    }
    await writeFile(PROFILE_FILE, JSON.stringify(payload, null, 2) + '\n', 'utf8')
    return res.json({ ok: true, active: to })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
})

export default router
