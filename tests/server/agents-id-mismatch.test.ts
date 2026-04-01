// @vitest-environment node
/**
 * Regression coverage for #150 — agent id mismatch.
 * sokrat alias vs backend/config/file endpoint expectations.
 * configIdFor('sokrat') → 'main' must work across all endpoints.
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
        skills: ['orchestrate', 'delegate'],
        model: { primary: 'claude-opus-4', fallbacks: ['sonnet-4'] },
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
  tempDir = await mkdtemp(join(tmpdir(), 'agents-id-mismatch-'))

  const heartbeatsDir = join(tempDir, 'clawd', 'runtime', 'heartbeats')
  const mailboxesDir = join(tempDir, 'clawd', 'runtime', 'mailboxes')
  const openclawDir = join(tempDir, '.openclaw')
  const workspacesDir = join(tempDir, 'clawd', 'runtime', 'workspaces')

  mkdirSync(heartbeatsDir, { recursive: true })
  mkdirSync(openclawDir, { recursive: true })

  // Create mailbox + workspace subdirs for sokrat
  for (const agent of ['sokrat', 'archimedes']) {
    for (const folder of ['inbox', 'processing', 'done', 'deadletter']) {
      mkdirSync(join(mailboxesDir, agent, folder), { recursive: true })
    }
    mkdirSync(join(workspacesDir, agent), { recursive: true })
  }

  // Heartbeat for sokrat
  writeFileSync(
    join(heartbeatsDir, 'sokrat.json'),
    JSON.stringify({ state: 'active', updated_at: '2026-03-31T00:00:00Z', workspace_path: join(workspacesDir, 'sokrat') }),
  )

  // Heartbeat for archimedes
  writeFileSync(
    join(heartbeatsDir, 'archimedes.json'),
    JSON.stringify({ state: 'idle', updated_at: '2026-03-31T00:00:00Z' }),
  )

  // Workspace file for sokrat
  writeFileSync(
    join(workspacesDir, 'sokrat', 'AGENTS.md'),
    '# Sokrat Agent File\n\nTest content for sokrat workspace.',
  )

  writeFileSync(join(openclawDir, 'openclaw.json'), JSON.stringify(OPENCLAW_CONFIG))

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

describe('agent id mismatch — sokrat alias resolution', () => {
  it('GET /api/agents resolves sokrat → main config for skills', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const sokrat = res.body.find((a: { id: string }) => a.id === 'sokrat')
    expect(sokrat).toBeDefined()
    // sokrat should get skills from 'main' config entry
    expect(sokrat.skills).toEqual(['orchestrate', 'delegate'])
  })

  it('GET /api/agents resolves sokrat → main config for model', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const sokrat = res.body.find((a: { id: string }) => a.id === 'sokrat')
    expect(sokrat.model).toBe('claude-opus-4')
  })

  it('GET /api/agents returns archimedes with its own config (no alias)', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const archimedes = res.body.find((a: { id: string }) => a.id === 'archimedes')
    expect(archimedes).toBeDefined()
    expect(archimedes.skills).toEqual(['build', 'test'])
    expect(archimedes.model).toBe('sonnet-4')
  })

  it('GET /api/agents/me returns valid agent identity', async () => {
    const res = await request(app).get('/api/agents/me')
    expect(res.status).toBe(200)
    expect(res.body.id).toBeTruthy()
    expect(res.body.name).toBeTruthy()
    expect(res.body.emoji).toBeTruthy()
    expect(res.body.role).toBeTruthy()
  })

  it('GET /api/agents/:id/files/:filename returns 404 for unknown agent workspace', async () => {
    const res = await request(app).get('/api/agents/unknown_agent_xyz/files/AGENTS.md')
    expect(res.status).toBe(404)
  })

  it('GET /api/agents/sokrat/files/AGENTS.md resolves listed agent files positively', async () => {
    const res = await request(app).get('/api/agents/sokrat/files/AGENTS.md')
    expect(res.status).toBe(200)
    expect(res.body.filename).toBe('AGENTS.md')
    expect(res.body.content).toContain('Sokrat Agent File')
  })

  it('sokrat heartbeat status resolves correctly', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    const sokrat = res.body.find((a: { id: string }) => a.id === 'sokrat')
    expect(sokrat.status).toBe('active')
    expect(sokrat.last_seen).toBe('2026-03-31T00:00:00Z')
  })

  it('agents without config get empty skills (no crash from alias resolution)', async () => {
    const res = await request(app).get('/api/agents')
    expect(res.status).toBe(200)

    // Agents not in openclaw.json config should get empty skills
    const herodotus = res.body.find((a: { id: string }) => a.id === 'herodotus')
    expect(herodotus).toBeDefined()
    expect(herodotus.skills).toEqual([])
    expect(herodotus.model).toBeNull()
  })

  it('GET /api/agents/sokrat/skills resolves via configIdFor to main config', async () => {
    const res = await request(app).get('/api/agents/sokrat/skills')
    expect(res.status).toBe(200)
    expect(res.body.skills).toEqual(['orchestrate', 'delegate'])
  })

  it('GET /api/agents/archimedes/skills resolves without alias', async () => {
    const res = await request(app).get('/api/agents/archimedes/skills')
    expect(res.status).toBe(200)
    expect(res.body.skills).toEqual(['build', 'test'])
  })

  it('GET /api/agents/leo/files/AGENTS.md returns empty content for agent without heartbeat (not 404)', async () => {
    // leo is in AGENT_META but has no heartbeat file — should not 404
    const res = await request(app).get('/api/agents/leo/files/AGENTS.md')
    expect(res.status).toBe(200)
    expect(res.body.filename).toBe('AGENTS.md')
    expect(res.body.content).toBe('')
  })

  it('every listed agent id resolves in files endpoint without 404', async () => {
    const listRes = await request(app).get('/api/agents')
    expect(listRes.status).toBe(200)

    for (const agent of listRes.body) {
      const fileRes = await request(app).get(`/api/agents/${agent.id}/files/AGENTS.md`)
      expect(fileRes.status).not.toBe(404)
    }
  })
})
