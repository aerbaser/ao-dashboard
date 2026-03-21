import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const STALE_THRESHOLD_MS = 5 * 60 * 1_000
const ALLOWED_PROFILES = new Set(['yura', 'dima'])

export const DEFAULT_RUNTIME_DIR = join(homedir(), 'clawd/runtime')

function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function getFallback() {
  return { cached: false, stale: true, profiles: [] }
}

function normalizeProfile(raw = {}) {
  return {
    profile: typeof raw.profile === 'string' && raw.profile.trim() ? raw.profile : 'unknown',
    tokens_used: toNumber(raw.tokens_used),
    tokens_limit: toNumber(raw.tokens_limit),
    requests_used: toNumber(raw.requests_used),
    requests_limit: toNumber(raw.requests_limit),
    reset_at: typeof raw.reset_at === 'string' ? raw.reset_at : '',
    model: typeof raw.model === 'string' ? raw.model : '',
  }
}

function normalizeProfiles(raw) {
  const input = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.profiles)
      ? raw.profiles
      : []

  return input
    .filter((profile) => profile && typeof profile === 'object')
    .map((profile) => normalizeProfile(profile))
}

function usageBucket(profile) {
  const haystack = `${profile.profile} ${profile.model}`.toLowerCase()
  return /(codex|gpt|o1|o3|o4|openai)/.test(haystack) ? 'codex' : 'claude'
}

function calculateUsagePercent(profiles, bucket) {
  return profiles.reduce((maxPercent, profile) => {
    if (usageBucket(profile) !== bucket || profile.tokens_limit <= 0) {
      return maxPercent
    }

    const percent = Math.round((profile.tokens_used / profile.tokens_limit) * 100)
    return Math.max(maxPercent, percent)
  }, 0)
}

export async function readRateLimitResponse({
  runtimeDir = DEFAULT_RUNTIME_DIR,
  now = Date.now(),
} = {}) {
  const cacheFile = join(runtimeDir, 'rate-limit-cache.json')

  try {
    const fileStat = await stat(cacheFile)
    if (now - fileStat.mtimeMs > STALE_THRESHOLD_MS) {
      return getFallback()
    }

    const raw = JSON.parse(await readFile(cacheFile, 'utf8'))
    return normalizeProfiles(raw)
  } catch {
    return getFallback()
  }
}

export async function readRateLimitSnapshot(options = {}) {
  const response = await readRateLimitResponse(options)
  if (!Array.isArray(response)) {
    return {
      ...response,
      claude_usage_percent: 0,
      codex_usage_percent: 0,
    }
  }

  return {
    cached: true,
    stale: false,
    profiles: response,
    claude_usage_percent: calculateUsagePercent(response, 'claude'),
    codex_usage_percent: calculateUsagePercent(response, 'codex'),
  }
}

export async function switchActiveProfile(to, { runtimeDir = DEFAULT_RUNTIME_DIR } = {}) {
  if (!ALLOWED_PROFILES.has(to)) {
    throw new Error(`Unsupported profile: ${to}`)
  }

  const profileFile = join(runtimeDir, 'active-profile.json')
  const payload = {
    active: to,
    updated_at: new Date().toISOString(),
  }

  await mkdir(runtimeDir, { recursive: true })
  await writeFile(profileFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')

  return payload
}
