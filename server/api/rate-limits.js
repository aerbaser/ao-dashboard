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

const PROFILE_ROWS = [
  { id: 'claude-max', profile: 'yura', label: 'Claude yura/Max' },
  { id: 'claude-fallback', profile: 'dima', label: 'Claude dima/fallback' },
  { id: 'codex-pro', profile: 'codex', label: 'Codex Pro' },
]

async function readActiveProfile() {
  try {
    const raw = await readFile(PROFILE_FILE, 'utf8')
    return JSON.parse(raw)?.active ?? null
  } catch {
    return null
  }
}

export function normalizeRateLimitProfiles(rawProfiles, activeProfile = null) {
  return PROFILE_ROWS.map((row) => {
    const source = rawProfiles.find((profile) => profile?.profile === row.profile) ?? null
    return {
      id: row.id,
      label: row.label,
      profile: row.profile,
      model: source?.model ?? (row.profile === 'codex' ? 'gpt-4.1' : 'claude-3-7-sonnet'),
      tokens_used: source?.tokens_used ?? 0,
      tokens_limit: source?.tokens_limit ?? 0,
      requests_used: source?.requests_used ?? 0,
      requests_limit: source?.requests_limit ?? 0,
      reset_at: source?.reset_at ?? null,
      active: activeProfile ? activeProfile === row.profile : row.profile === 'yura',
    }
  })
}

/**
 * GET /api/rate-limits
 * Returns profiles array from cache file. Gracefully handles missing/stale.
 */
router.get('/', async (_req, res) => {
  try {
    const fileStat = await stat(CACHE_FILE).catch(() => null)

    if (!fileStat) {
      return res.json({ cached: false, stale: true, profiles: normalizeRateLimitProfiles([]) })
    }

    const ageMs = Date.now() - fileStat.mtimeMs
    const stale = ageMs > STALE_THRESHOLD_MS
    const raw = await readFile(CACHE_FILE, 'utf8')
    const data = JSON.parse(raw)
    const profiles = Array.isArray(data.profiles) ? data.profiles : []
    const activeProfile = await readActiveProfile()

    return res.json({ cached: true, stale, profiles: normalizeRateLimitProfiles(profiles, activeProfile) })
  } catch {
    // Never throw 500 — return safe fallback
    return res.json({ cached: false, stale: true, profiles: normalizeRateLimitProfiles([]) })
  }
})

/**
 * POST /api/rate-limits/switch
 * Accepts { to: "yura" | "dima" }, writes active-profile.json.
 */
router.post('/switch', async (req, res) => {
  const to = req.body?.to ?? req.body?.profile

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
