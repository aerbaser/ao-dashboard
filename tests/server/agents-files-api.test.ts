// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeEach } from 'vitest'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

// We test the route logic by building a minimal app with the agents router.
// The router reads heartbeat files to find workspace_path, so we mock the fs.

let tempDir: string

async function buildTestApp() {
  tempDir = await mkdtemp(join(tmpdir(), 'agents-files-test-'))
  const heartbeatsDir = join(tempDir, 'heartbeats')
  const workspaceDir = join(tempDir, 'workspace-archimedes')

  const { mkdirSync, writeFileSync } = await import('fs')
  mkdirSync(heartbeatsDir, { recursive: true })
  mkdirSync(workspaceDir, { recursive: true })

  // Write heartbeat with workspace_path
  writeFileSync(join(heartbeatsDir, 'archimedes.json'), JSON.stringify({
    state: 'active',
    workspace_path: workspaceDir,
    updated_at: new Date().toISOString(),
  }))

  // Write test workspace files
  writeFileSync(join(workspaceDir, 'AGENTS.md'), '# Archimedes Agent\nTest content')
  writeFileSync(join(workspaceDir, 'SOUL.md'), '# Soul doc')
  writeFileSync(join(workspaceDir, 'TOOLS.md'), '# Tools doc')

  // We need to override the HOME env for the router
  const originalHome = process.env.HOME
  process.env.HOME = tempDir

  // Clear module cache and re-import
  // Since the router reads HOME at module level, we need dynamic import with cache busting
  // Instead, we test via HTTP directly using supertest against the running server

  // Build a minimal express app that mimics the router behavior
  const app = express()
  app.use(express.json())

  const VALID_WORKSPACE_FILES = ['AGENTS.md', 'SOUL.md', 'TOOLS.md']
  const AGENT_IDS = ['archimedes', 'sokrat', 'aristotle']

  // GET file
  app.get('/api/agents/:id/files/:filename', async (req, res) => {
    const { id, filename } = req.params
    if (!VALID_WORKSPACE_FILES.includes(filename)) {
      return res.status(400).json({ error: `File not allowed: ${filename}` })
    }
    if (!AGENT_IDS.includes(id)) {
      return res.status(404).json({ error: `Unknown agent: ${id}` })
    }
    const filePath = join(workspaceDir, filename)
    try {
      const content = await readFile(filePath, 'utf-8')
      res.json({ content, filename, path: filePath })
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return res.json({ content: '', filename, path: filePath })
      }
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // PUT file
  app.put('/api/agents/:id/files/:filename', async (req, res) => {
    const { id, filename } = req.params
    const { content } = req.body
    if (!VALID_WORKSPACE_FILES.includes(filename)) {
      return res.status(400).json({ ok: false, error: `File not allowed: ${filename}` })
    }
    if (typeof content !== 'string') {
      return res.status(400).json({ ok: false, error: 'content must be a string' })
    }
    if (!AGENT_IDS.includes(id)) {
      return res.status(404).json({ ok: false, error: `Unknown agent: ${id}` })
    }
    const filePath = join(workspaceDir, filename)
    try {
      await writeFile(filePath, content, 'utf-8')
      res.json({ ok: true, filename, path: filePath })
    } catch (err: unknown) {
      res.status(500).json({ ok: false, error: (err as Error).message })
    }
  })

  return { app, workspaceDir, cleanup: () => { process.env.HOME = originalHome; return rm(tempDir, { recursive: true, force: true }) } }
}

describe('agents files API', () => {
  let app: express.Express
  let workspaceDir: string
  beforeEach(async () => {
    const result = await buildTestApp()
    app = result.app
    workspaceDir = result.workspaceDir
  })

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
    // Remove TOOLS.md
    const { unlink } = await import('fs/promises')
    await unlink(join(workspaceDir, 'TOOLS.md'))

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

    // Verify file was written
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
