// @vitest-environment node
/**
 * Tests exercise the ACTUAL agents router (server/api/agents.js).
 *
 * Strategy: stub HOME before importing the router so it resolves paths
 * to our temp directory. The router reads HEARTBEATS_DIR and
 * MAILBOXES_DIR at module scope using homedir()/process.env.HOME.
 */
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string
let workspaceDir: string
let app: express.Express
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'agents-files-test-'))

  // Mimic directory layout the router expects
  const heartbeatsDir = join(tempDir, 'clawd', 'runtime', 'heartbeats')
  const mailboxesDir = join(tempDir, 'clawd', 'runtime', 'mailboxes')
  workspaceDir = join(tempDir, '.openclaw', 'workspace-archimedes')

  mkdirSync(heartbeatsDir, { recursive: true })
  mkdirSync(mailboxesDir, { recursive: true })
  mkdirSync(workspaceDir, { recursive: true })

  // Write heartbeat pointing to our workspace
  writeFileSync(join(heartbeatsDir, 'archimedes.json'), JSON.stringify({
    state: 'active',
    workspace_path: workspaceDir,
    updated_at: new Date().toISOString(),
  }))

  // Write workspace files
  writeFileSync(join(workspaceDir, 'AGENTS.md'), '# Archimedes Agent\nTest content')
  writeFileSync(join(workspaceDir, 'SOUL.md'), '# Soul doc')
  writeFileSync(join(workspaceDir, 'TOOLS.md'), '# Tools doc')

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

describe('agents files API (actual router)', () => {
  it('GET reads a whitelisted workspace file', async () => {
    const res = await request(app).get('/api/agents/archimedes/files/AGENTS.md')
    expect(res.status).toBe(200)
    expect(res.body.content).toBe('# Archimedes Agent\nTest content')
    expect(res.body.filename).toBe('AGENTS.md')
  })

  it('GET rejects non-whitelisted filenames', async () => {
    const res = await request(app).get('/api/agents/archimedes/files/secret.env')
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('File not allowed')
  })

  it('GET rejects traversal attempts', async () => {
    const res = await request(app).get('/api/agents/archimedes/files/..%2F..%2Fetc%2Fpasswd')
    expect(res.status).toBe(400)
  })

  it('GET returns empty content for nonexistent file', async () => {
    const { unlink } = await import('fs/promises')
    await unlink(join(workspaceDir, 'TOOLS.md')).catch(() => {})

    const res = await request(app).get('/api/agents/archimedes/files/TOOLS.md')
    expect(res.status).toBe(200)
    expect(res.body.content).toBe('')
  })

  it('GET returns 404 for unknown agent', async () => {
    const res = await request(app).get('/api/agents/unknown-agent/files/AGENTS.md')
    expect(res.status).toBe(404)
  })

  it('PUT writes file content', async () => {
    const res = await request(app)
      .put('/api/agents/archimedes/files/AGENTS.md')
      .send({ content: '# Updated\nNew content' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const written = await readFile(join(workspaceDir, 'AGENTS.md'), 'utf-8')
    expect(written).toBe('# Updated\nNew content')
  })

  it('PUT rejects non-whitelisted filenames', async () => {
    const res = await request(app)
      .put('/api/agents/archimedes/files/secret.env')
      .send({ content: 'hack' })
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })

  it('PUT rejects missing content', async () => {
    const res = await request(app)
      .put('/api/agents/archimedes/files/AGENTS.md')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('content must be a string')
  })

  it('PUT rejects non-string content', async () => {
    const res = await request(app)
      .put('/api/agents/archimedes/files/AGENTS.md')
      .send({ content: 123 })
    expect(res.status).toBe(400)
  })
})
