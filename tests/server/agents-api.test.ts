// @vitest-environment node
/**
 * Tests for GET /api/agents — skills and model enrichment from openclaw.json.
 *
 * Strategy: stub HOME before importing the router so paths resolve to our
 * temp directory (same pattern as agents-files-api.test.ts).
 */
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string
let app: express.Express
let originalHome: string

const OPENCLAW_CONFIG = {
  agents: {
    list: [
      {
        id: 'main',
        skills: ['skill-a', 'skill-b'],
        model: { primary: 'claude-opus-4', fallbacks: [] },
      },
      {
        id: 'archimedes',
        skills: ['build', 'test'],
        model: { primary: 'sonnet-4' },
      },
    ],
  },
}

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agents-api-test-'))

  const heartbeatsDir = join(tempDir, 'clawd', 'runtime', 'heartbeats')
  const mailboxesDir = join(tempDir, 'clawd', 'runtime', 'mailboxes')
  const openclawDir = join(tempDir, '.openclaw')

  mkdirSync(heartbeatsDir, { recursive: true })
  mkdirSync(openclawDir, { recursive: true })

  // Create mailbox subdirs for sokrat and archimedes
  for (const agent of ['sokrat', 'archimedes']) {
    for (const folder of ['inbox', 'processing', 'done', 'deadletter']) {
      mkdirSync(join(mailboxesDir, agent, folder), { recursive: true })
    }
  }

  // Heartbeat files
  writeFileSync(
    join(heartbeatsDir, 'sokrat.json'),
    JSON.stringify({ state: 'active', updated_at: '2026-01-01T00:00:00Z' }),
  )
  writeFileSync(
    join(heartbeatsDir, 'archimedes.json'),
    JSON.stringify({ state: 'idle', updated_at: '2026-01-01T00:00:00Z' }),
  )

  // openclaw.json config
  writeFileSync(join(openclawDir, 'openclaw.json'), JSON.stringify(OPENCLAW_CONFIG))

  // Stub HOME BEFORE importing router — module resolves paths at import time
  originalHome = process.env.HOME!
  process.env.HOME = tempDir

  const { default: agentsRouter } = await import('../../server/api/agents.js')

  app = express()
  app.use(express.json())
  app.use('/api/agents', agentsRouter)
})

afterAll(async () => {
  process.env.HOME = originalHome
  await rm(tempDir, { recursive: true, force: true })
})

describe('agents API — skills enrichment from openclaw.json', () => {
  it('GET /api/agents returns skills from openclaw.json', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const agents: Array<{ id: string; skills: string[] }> = res.body
    const sokrat = agents.find(a => a.id === 'sokrat')
    const archimedes = agents.find(a => a.id === 'archimedes')

    expect(sokrat).toBeDefined()
    expect(sokrat!.skills).toEqual(['skill-a', 'skill-b'])

    expect(archimedes).toBeDefined()
    expect(archimedes!.skills).toEqual(['build', 'test'])
  })

  it('GET /api/agents returns model from config', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const agents: Array<{ id: string; model: string | null }> = res.body
    const sokrat = agents.find(a => a.id === 'sokrat')
    const archimedes = agents.find(a => a.id === 'archimedes')

    expect(sokrat!.model).toBe('claude-opus-4')
    expect(archimedes!.model).toBe('sonnet-4')
  })

  it('GET /api/agents returns empty skills when agent not in config', async () => {
    // "aristotle" is in AGENT_META but NOT in the openclaw.json config list
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const agents: Array<{ id: string; skills: string[] }> = res.body
    const aristotle = agents.find(a => a.id === 'aristotle')

    expect(aristotle).toBeDefined()
    expect(aristotle!.skills).toEqual([])
  })

  it('configIdFor maps sokrat to main — sokrat gets main config entry skills', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const agents: Array<{ id: string; skills: string[] }> = res.body
    const sokrat = agents.find(a => a.id === 'sokrat')

    // sokrat → configIdFor returns "main" → matches the "main" entry in openclaw.json
    expect(sokrat!.skills).toEqual(OPENCLAW_CONFIG.agents.list[0].skills)
  })
})
