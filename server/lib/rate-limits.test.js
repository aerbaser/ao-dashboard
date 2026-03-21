import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, utimes } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  readRateLimitResponse,
  readRateLimitSnapshot,
  switchActiveProfile,
} from './rate-limits.js'

async function makeRuntimeDir() {
  const root = await mkdtemp(join(tmpdir(), 'ao-dashboard-rate-limits-'))
  const runtimeDir = join(root, 'runtime')
  await mkdir(runtimeDir, { recursive: true })
  return runtimeDir
}

test('readRateLimitResponse returns a safe fallback when the cache file is missing', async () => {
  const runtimeDir = await makeRuntimeDir()

  const response = await readRateLimitResponse({ runtimeDir })

  assert.deepEqual(response, { cached: false, stale: true, profiles: [] })
})

test('readRateLimitResponse returns profiles when the cache file is fresh', async () => {
  const runtimeDir = await makeRuntimeDir()
  const cacheFile = join(runtimeDir, 'rate-limit-cache.json')

  await writeFile(cacheFile, JSON.stringify({
    profiles: [
      {
        profile: 'yura',
        tokens_used: 25,
        tokens_limit: 100,
        requests_used: 2,
        requests_limit: 10,
        reset_at: '2026-03-21T08:00:00.000Z',
        model: 'claude-3-7-sonnet',
      },
    ],
  }))

  const response = await readRateLimitResponse({ runtimeDir })

  assert.ok(Array.isArray(response))
  assert.equal(response.length, 1)
  assert.equal(response[0].profile, 'yura')
})

test('readRateLimitResponse returns a stale fallback when the cache is older than five minutes', async () => {
  const runtimeDir = await makeRuntimeDir()
  const cacheFile = join(runtimeDir, 'rate-limit-cache.json')

  await writeFile(cacheFile, JSON.stringify({
    profiles: [{ profile: 'dima', tokens_used: 5, tokens_limit: 10 }],
  }))

  const staleAt = new Date(Date.now() - 6 * 60 * 1_000)
  await utimes(cacheFile, staleAt, staleAt)

  const response = await readRateLimitResponse({ runtimeDir })

  assert.deepEqual(response, { cached: false, stale: true, profiles: [] })
})

test('readRateLimitSnapshot derives claude and codex usage from the cache file', async () => {
  const runtimeDir = await makeRuntimeDir()
  const cacheFile = join(runtimeDir, 'rate-limit-cache.json')

  await writeFile(cacheFile, JSON.stringify({
    profiles: [
      {
        profile: 'yura',
        tokens_used: 40,
        tokens_limit: 100,
        requests_used: 2,
        requests_limit: 10,
        reset_at: '2026-03-21T08:00:00.000Z',
        model: 'claude-3-7-sonnet',
      },
      {
        profile: 'codex',
        tokens_used: 15,
        tokens_limit: 20,
        requests_used: 1,
        requests_limit: 5,
        reset_at: '2026-03-21T08:00:00.000Z',
        model: 'gpt-4.1',
      },
    ],
  }))

  const snapshot = await readRateLimitSnapshot({ runtimeDir })

  assert.equal(snapshot.claude_usage_percent, 40)
  assert.equal(snapshot.codex_usage_percent, 75)
  assert.equal(snapshot.cached, true)
  assert.equal(snapshot.stale, false)
  assert.equal(snapshot.profiles.length, 2)
})

test('switchActiveProfile writes active-profile.json', async () => {
  const runtimeDir = await makeRuntimeDir()

  const payload = await switchActiveProfile('dima', { runtimeDir })
  const written = JSON.parse(await readFile(join(runtimeDir, 'active-profile.json'), 'utf8'))

  assert.deepEqual(payload.active, 'dima')
  assert.equal(written.active, 'dima')
  assert.match(written.updated_at, /^\d{4}-\d{2}-\d{2}T/)
})
