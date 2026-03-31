// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(new Error('skip external GH/AO in smoke tests'), '', 'skip external GH/AO in smoke tests')
  }),
}))

vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch in smoke tests')))

let tempDir: string
let app: express.Express
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tasks-list-smoke-'))
  originalHome = process.env.HOME || ''
  process.env.HOME = tempDir

  const taskDir = join(tempDir, 'clawd', 'tasks', 'tsk_test_smoke')
  await mkdir(taskDir, { recursive: true })
  await writeFile(
    join(taskDir, 'contract.json'),
    JSON.stringify({
      title: 'Smoke task',
      route: 'build_route',
      outcome_type: 'app_release',
    }),
  )
  await writeFile(
    join(taskDir, 'status.json'),
    JSON.stringify({
      state: 'EXECUTION',
      current_owner: 'archimedes',
      current_route: 'build_route',
      blockers: [],
      retries: 0,
      updated_at: '2026-03-31T16:00:00Z',
      last_material_update: '2026-03-31T16:00:00Z',
    }),
  )
  await writeFile(
    join(taskDir, 'events.ndjson'),
    [
      JSON.stringify({ event_type: 'STATE_CHANGED', actor: 'platon' }),
      JSON.stringify({ event_type: 'USER_COMMENT', actor: 'archimedes', body: 'working on it' }),
    ].join('\n') + '\n',
  )

  const { default: tasksRouter } = await import('../../server/api/tasks.js')
  app = express()
  app.use(express.json())
  app.use('/api/tasks', tasksRouter)
})

afterAll(async () => {
  process.env.HOME = originalHome
  await rm(tempDir, { recursive: true, force: true })
})

describe('tasks list API smoke', () => {
  it('GET /api/tasks returns task list items with contract + status shape', async () => {
    const res = await request(app).get('/api/tasks')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({
      task_id: 'tsk_test_smoke',
      contract: {
        title: 'Smoke task',
        route: 'build_route',
        outcome_type: 'app_release',
      },
      status: {
        state: 'EXECUTION',
        current_owner: 'archimedes',
        current_route: 'build_route',
      },
      actors: ['platon', 'archimedes'],
      lastAgentMessage: 'working on it',
    })
  })
})
