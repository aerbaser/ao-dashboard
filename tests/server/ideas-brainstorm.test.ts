// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let app: express.Express
let tempDir: string
let ideasDir: string
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'ideas-brainstorm-test-'))
  ideasDir = join(tempDir, 'clawd', 'ideas')
  mkdirSync(ideasDir, { recursive: true })
  mkdirSync(join(tempDir, 'clawd', 'runtime', 'mailboxes', 'brainstorm-claude', 'inbox'), { recursive: true })

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

describe('Ideas brainstorm dispatch', () => {
  it('transitions draft to brainstorming', async () => {
    const id = 'idea_20260328_ddd444'
    writeFileSync(join(ideasDir, `${id}.json`), JSON.stringify({
      id, title: 'Test', body: 'desc', status: 'draft',
      target_agent: 'brainstorm-claude', created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    const res = await request(app).post(`/api/ideas/${id}/brainstorm`)
    expect(res.status).toBe(202)
    expect(res.body.status).toBe('brainstorming')
  })

  it('rejects brainstorm on non-draft idea', async () => {
    const id = 'idea_20260328_eee555'
    writeFileSync(join(ideasDir, `${id}.json`), JSON.stringify({
      id, title: 'Test', body: 'desc', status: 'brainstorming',
      target_agent: 'brainstorm-claude', created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    const res = await request(app).post(`/api/ideas/${id}/brainstorm`)
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Cannot brainstorm')
  })

  it('rejects invalid id for brainstorm', async () => {
    const res = await request(app).post('/api/ideas/INVALID/brainstorm')
    expect(res.status).toBe(404)
  })
})

describe('Ideas loadIdea exact match', () => {
  it('does not match substring ids on brainstorm route', async () => {
    const realId = 'idea_20260328_bbb222'
    writeFileSync(join(ideasDir, `${realId}.json`), JSON.stringify({
      id: realId, title: 'Real', body: '', status: 'draft',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }))
    // Try to load with wrong id — should 404 (not found because exact match)
    const res = await request(app).post('/api/ideas/idea_20260328_bbb223/brainstorm')
    expect(res.status).toBe(404)
  })
})
