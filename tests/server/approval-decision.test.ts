// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let app: express.Express
let tempDir: string
let originalHome: string
let ideasDir: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'approval-test-'))
  ideasDir = join(tempDir, 'clawd', 'ideas')
  mkdirSync(ideasDir, { recursive: true })

  originalHome = process.env.HOME!
  process.env.HOME = tempDir

  const { default: ideasRouter } = await import('../../server/api/ideas.js')

  app = express()
  app.use(express.json())
  app.use('/api/ideas', ideasRouter)
})

afterAll(async () => {
  process.env.HOME = originalHome
  await rm(tempDir, { recursive: true, force: true })
})

function writeIdea(id: string, overrides: Record<string, unknown> = {}) {
  const idea = {
    id,
    title: 'Test idea',
    body: 'Body text',
    status: 'pending_approval',
    tags: [],
    target_agent: 'brainstorm-claude',
    pending_since: '2026-04-01T10:00:00Z',
    approval_decisions: [],
    created_at: '2026-03-31T00:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    ...overrides,
  }
  return writeFile(join(ideasDir, `${id}.json`), JSON.stringify(idea, null, 2))
}

describe('POST /api/ideas/:id/decision', () => {
  beforeEach(async () => {
    await writeIdea('idea_20260401_aaa111')
  })

  it('yes: transitions to approved and records decision', async () => {
    const res = await request(app)
      .post('/api/ideas/idea_20260401_aaa111/decision')
      .send({ action: 'yes' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.idea.status).toBe('approved')
    expect(res.body.decision.action).toBe('yes')
    expect(res.body.decision.actor).toBe('platon')
    expect(res.body.idea.approval_decisions).toHaveLength(1)
  })

  it('later: stays pending_approval and records decision', async () => {
    const res = await request(app)
      .post('/api/ideas/idea_20260401_aaa111/decision')
      .send({ action: 'later', reason: 'Need more info' })
    expect(res.status).toBe(200)
    expect(res.body.idea.status).toBe('pending_approval')
    expect(res.body.decision.action).toBe('later')
    expect(res.body.decision.reason).toBe('Need more info')
  })

  it('no: transitions to archived', async () => {
    const res = await request(app)
      .post('/api/ideas/idea_20260401_aaa111/decision')
      .send({ action: 'no', reason: 'Not aligned with goals' })
    expect(res.status).toBe(200)
    expect(res.body.idea.status).toBe('archived')
    expect(res.body.decision.action).toBe('no')
    expect(res.body.decision.reason).toBe('Not aligned with goals')
  })

  it('rescope: transitions back to draft and clears pending_since', async () => {
    const res = await request(app)
      .post('/api/ideas/idea_20260401_aaa111/decision')
      .send({ action: 'rescope', reason: 'Needs narrower scope' })
    expect(res.status).toBe(200)
    expect(res.body.idea.status).toBe('draft')
    expect(res.body.idea.pending_since).toBeNull()
    expect(res.body.decision.action).toBe('rescope')
  })

  it('rejects invalid action', async () => {
    const res = await request(app)
      .post('/api/ideas/idea_20260401_aaa111/decision')
      .send({ action: 'maybe' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid action/)
  })

  it('rejects decision on non-pending idea (stale state)', async () => {
    await writeIdea('idea_20260401_bbb222', { status: 'approved' })
    const res = await request(app)
      .post('/api/ideas/idea_20260401_bbb222/decision')
      .send({ action: 'yes' })
    expect(res.status).toBe(409)
    expect(res.body.error).toBe('STALE_STATE')
    expect(res.body.current_status).toBe('approved')
  })

  it('returns 404 for non-existent idea', async () => {
    const res = await request(app)
      .post('/api/ideas/idea_20260401_aaa999/decision')
      .send({ action: 'yes' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('idea not found')
  })

  it('accumulates multiple decisions on same idea', async () => {
    // First: later
    await request(app)
      .post('/api/ideas/idea_20260401_aaa111/decision')
      .send({ action: 'later', reason: 'First pass' })

    // Second: yes (still pending_approval after later)
    const res = await request(app)
      .post('/api/ideas/idea_20260401_aaa111/decision')
      .send({ action: 'yes' })
    expect(res.status).toBe(200)
    expect(res.body.idea.approval_decisions).toHaveLength(2)
    expect(res.body.idea.approval_decisions[0].action).toBe('later')
    expect(res.body.idea.approval_decisions[1].action).toBe('yes')
  })

  it('rejects invalid id format', async () => {
    const res = await request(app)
      .post('/api/ideas/invalid-id-format/decision')
      .send({ action: 'yes' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid idea id/)
  })
})

describe('POST /api/ideas/:id/submit-for-approval', () => {
  it('transitions artifact_ready to pending_approval', async () => {
    await writeIdea('idea_20260401_ccc333', {
      status: 'artifact_ready',
      pending_since: null,
    })
    const res = await request(app)
      .post('/api/ideas/idea_20260401_ccc333/submit-for-approval')
      .send()
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('pending_approval')
    expect(res.body.pending_since).toBeTruthy()
  })

  it('rejects non-artifact_ready ideas', async () => {
    await writeIdea('idea_20260401_ddd444', { status: 'draft' })
    const res = await request(app)
      .post('/api/ideas/idea_20260401_ddd444/submit-for-approval')
      .send()
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Cannot submit for approval/)
  })
})

describe('GET /api/ideas?status=pending_approval', () => {
  it('filters to only pending_approval ideas', async () => {
    await writeIdea('idea_20260401_eee555', { status: 'pending_approval' })
    await writeIdea('idea_20260401_fff666', { status: 'draft' })

    const res = await request(app)
      .get('/api/ideas?status=pending_approval')
    expect(res.status).toBe(200)
    const ids = res.body.map((i: { id: string }) => i.id)
    expect(ids).toContain('idea_20260401_eee555')
    expect(ids).not.toContain('idea_20260401_fff666')
  })
})
