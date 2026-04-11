// @vitest-environment node
/**
 * Tests for POST /api/tasks/:id/transition — state machine validation.
 *
 * Strategy: mock child_process.execFile and fs to simulate task-store and status.json,
 * then verify the endpoint rejects invalid transitions.
 */
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, vi, beforeEach } from 'vitest'

// --- Mock fs for readTaskState ---
const mockStatusState: Record<string, string> = {}

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      if (typeof p === 'string' && p.includes('status.json')) {
        const taskId = p.split('/').slice(-2, -1)[0]
        return taskId in mockStatusState
      }
      return (actual.existsSync as (p: string) => boolean)(p)
    }),
    readFileSync: vi.fn((p: string, enc?: string) => {
      if (typeof p === 'string' && p.includes('status.json')) {
        const taskId = p.split('/').slice(-2, -1)[0]
        if (taskId in mockStatusState) {
          return JSON.stringify({ state: mockStatusState[taskId] })
        }
      }
      return (actual.readFileSync as (p: string, enc?: string) => string)(p, enc)
    }),
    createReadStream: actual.createReadStream,
    mkdirSync: vi.fn(),
    appendFileSync: vi.fn(),
  }
})

// Mock child_process.execFile — transition succeeds by default
vi.mock('child_process', () => ({
  execFile: vi.fn(
    (_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      cb(null, 'ok', '')
    },
  ),
}))

// Mock readline for readNDJSON
vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'close') handler()
      return { on: vi.fn((e2: string, _h2: (...args: unknown[]) => void) => {
        if (e2 === 'error') { /* noop */ }
        return { on: vi.fn() }
      })}
    }),
  })),
}))

vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch')))

let app: express.Express

beforeAll(async () => {
  const { default: tasksRouter } = await import('../../server/api/tasks.js')
  app = express()
  app.use(express.json())
  app.use('/api/tasks', tasksRouter)
})

beforeEach(() => {
  // Clear mock state
  for (const key of Object.keys(mockStatusState)) delete mockStatusState[key]
})

describe('POST /api/tasks/:id/transition — state machine validation', () => {
  it('rejects invalid transition (DONE → INTAKE)', async () => {
    mockStatusState['tsk_test'] = 'DONE'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'INTAKE' })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('INVALID_TRANSITION')
    expect(res.body.detail).toContain('DONE')
    expect(res.body.detail).toContain('INTAKE')
  })

  it('allows valid transition (IDEA_PENDING_APPROVAL → APPROVED)', async () => {
    mockStatusState['tsk_test'] = 'IDEA_PENDING_APPROVAL'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'APPROVED' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('allows valid transition (IN_BUILD → PR_READY)', async () => {
    mockStatusState['tsk_test'] = 'IN_BUILD'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'PR_READY' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('allows MERGED_NOT_DEPLOYED → DEPLOYED_NOT_VERIFIED', async () => {
    mockStatusState['tsk_test'] = 'MERGED_NOT_DEPLOYED'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'DEPLOYED_NOT_VERIFIED' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('allows LIVE_ACCEPTANCE → DONE (proof pass)', async () => {
    mockStatusState['tsk_test'] = 'LIVE_ACCEPTANCE'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'DONE' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('allows LIVE_ACCEPTANCE → IN_SPEC (reopen on proof fail)', async () => {
    mockStatusState['tsk_test'] = 'LIVE_ACCEPTANCE'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'IN_SPEC' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejects MERGED_NOT_DEPLOYED → DONE (must go through LIVE_ACCEPTANCE)', async () => {
    mockStatusState['tsk_test'] = 'MERGED_NOT_DEPLOYED'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'DONE' })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('INVALID_TRANSITION')
  })

  // Legacy flow tests
  it('allows valid legacy transition (INTAKE → CONTEXT)', async () => {
    mockStatusState['tsk_test'] = 'INTAKE'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'CONTEXT' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('allows valid legacy transition (EXECUTION → BLOCKED)', async () => {
    mockStatusState['tsk_test'] = 'EXECUTION'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'BLOCKED' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('allows force flag to bypass validation', async () => {
    mockStatusState['tsk_test'] = 'DONE'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'INTAKE', force: true })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('skips validation when task has no status.json (e.g. GitHub tasks)', async () => {
    const res = await request(app)
      .post('/api/tasks/tsk_unknown/transition')
      .send({ state: 'IN_BUILD' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('rejects BLOCKED → DONE (must go through EXECUTION or IN_BUILD)', async () => {
    mockStatusState['tsk_test'] = 'BLOCKED'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'DONE' })

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('INVALID_TRANSITION')
    expect(res.body.detail).toContain('Valid transitions: EXECUTION, IN_BUILD')
  })

  it('allows legacy bridge: FINALIZING → MERGED_NOT_DEPLOYED', async () => {
    mockStatusState['tsk_test'] = 'FINALIZING'

    const res = await request(app)
      .post('/api/tasks/tsk_test/transition')
      .send({ state: 'MERGED_NOT_DEPLOYED' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
