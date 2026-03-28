// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let app: express.Express
let tempDir: string
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'ideas-api-test-'))
  mkdirSync(join(tempDir, 'clawd', 'ideas'), { recursive: true })

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

describe('Ideas API CRUD', () => {
  let createdId: string

  it('POST creates a new idea', async () => {
    const res = await request(app)
      .post('/api/ideas')
      .send({ title: 'Test idea', body: 'Description', tags: ['test'], target_agent: 'brainstorm-claude' })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Test idea')
    expect(res.body.status).toBe('draft')
    expect(res.body.id).toMatch(/^idea_\d{8}_[a-f0-9]{6}$/)
    createdId = res.body.id
  })

  it('POST rejects empty title', async () => {
    const res = await request(app).post('/api/ideas').send({ title: '' })
    expect(res.status).toBe(400)
  })

  it('GET lists ideas', async () => {
    const res = await request(app).get('/api/ideas')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('GET filters by status', async () => {
    const res = await request(app).get('/api/ideas?status=draft')
    expect(res.status).toBe(200)
    expect(res.body.every((i: { status: string }) => i.status === 'draft')).toBe(true)
  })

  it('PUT updates idea', async () => {
    const res = await request(app)
      .put(`/api/ideas/${createdId}`)
      .send({ title: 'Updated title', status: 'brainstorming' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('Updated title')
    expect(res.body.status).toBe('brainstorming')
  })

  it('POST approve transitions to approved', async () => {
    const res = await request(app).post(`/api/ideas/${createdId}/approve`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('approved')
  })

  it('DELETE archives idea', async () => {
    const res = await request(app).delete(`/api/ideas/${createdId}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('archived')
  })
})

describe('Ideas API validation', () => {
  it('PUT rejects invalid id format (path traversal)', async () => {
    const res = await request(app)
      .put('/api/ideas/idea_NOTVALID_xyz')
      .send({ title: 'hack' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Invalid idea id')
  })

  it('POST approve rejects invalid id', async () => {
    const res = await request(app).post('/api/ideas/invalid_id/approve')
    expect(res.status).toBe(400)
  })

  it('DELETE rejects invalid id', async () => {
    const res = await request(app).delete('/api/ideas/not_a_valid_id')
    expect(res.status).toBe(400)
  })

  it('PUT returns 404 for nonexistent idea', async () => {
    const res = await request(app)
      .put('/api/ideas/idea_20260101_abcdef')
      .send({ title: 'ghost' })
    expect(res.status).toBe(404)
  })
})
