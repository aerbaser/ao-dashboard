// @vitest-environment node
/**
 * Regression tests for #154 — open GitHub issues must not be silently omitted
 * when they lack the agent:archimedes label.
 *
 * Covers: unlabeled issue, agent:archimedes, other agent:* label,
 * agent:backlog, and mixed datasets.
 */
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { mkdtemp, rm, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const MOCK_ISSUES = [
  {
    number: 200,
    title: 'feat: routed issue',
    state: 'OPEN',
    labels: [{ name: 'agent:archimedes' }, { name: 'priority:p1' }],
    createdAt: '2026-03-01T00:00:00Z',
    closedAt: null,
  },
  {
    number: 201,
    title: 'bug: unlabeled issue',
    state: 'OPEN',
    labels: [{ name: 'bug' }],
    createdAt: '2026-03-02T00:00:00Z',
    closedAt: null,
  },
  {
    number: 202,
    title: 'feat: other agent issue',
    state: 'OPEN',
    labels: [{ name: 'agent:hephaestus' }, { name: 'priority:p2' }],
    createdAt: '2026-03-03T00:00:00Z',
    closedAt: null,
  },
  {
    number: 203,
    title: 'chore: backlog issue',
    state: 'OPEN',
    labels: [{ name: 'agent:backlog' }],
    createdAt: '2026-03-04T00:00:00Z',
    closedAt: null,
  },
  {
    number: 204,
    title: 'fix: closed issue',
    state: 'CLOSED',
    labels: [{ name: 'agent:archimedes' }],
    createdAt: '2026-02-01T00:00:00Z',
    closedAt: '2026-03-10T00:00:00Z',
  },
  {
    number: 205,
    title: 'feat: no labels at all',
    state: 'OPEN',
    labels: [],
    createdAt: '2026-03-05T00:00:00Z',
    closedAt: null,
  },
]

vi.mock('child_process', () => ({
  execFile: vi.fn(
    (cmd: string, args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
      if (cmd.endsWith('/gh') && args[0] === 'issue') {
        const repoIdx = args.indexOf('--repo')
        const repo = repoIdx >= 0 ? args[repoIdx + 1] : ''
        if (repo === 'aerbaser/ao-dashboard') {
          cb(null, JSON.stringify(MOCK_ISSUES), '')
        } else {
          cb(null, '[]', '')
        }
        return
      }
      cb(new Error('skip'), '', 'skip')
    },
  ),
}))

vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch in tests')))

let tempDir: string
let app: express.Express
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tasks-unrouted-'))
  originalHome = process.env.HOME || ''
  process.env.HOME = tempDir

  // Create empty tasks dir so local task scan doesn't error
  await mkdir(join(tempDir, 'clawd', 'tasks'), { recursive: true })

  const { default: tasksRouter } = await import('../../server/api/tasks.js')
  app = express()
  app.use(express.json())
  app.use('/api/tasks', tasksRouter)
})

afterAll(async () => {
  process.env.HOME = originalHome
  await rm(tempDir, { recursive: true, force: true })
})

type TaskItem = {
  task_id: string
  contract: { title: string }
  status: { state: string; current_owner: string }
  actors: string[]
}

describe('tasks API — unrouted issue visibility (#154)', () => {
  it('returns all open issues regardless of agent label', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(200)

    const tasks: TaskItem[] = res.body
    // Should see all 6 issues (200-205), not just the agent:archimedes ones
    const ghTasks = tasks.filter(t => t.task_id.startsWith('gh-'))
    expect(ghTasks).toHaveLength(6)
  })

  it('classifies agent:archimedes issue as IN_SPEC with platon owner', async () => {
    const res = await request(app).get('/api/tasks')
    const task = (res.body as TaskItem[]).find(t => t.task_id === 'gh-ao-dashboard-200')
    expect(task).toBeDefined()
    expect(task!.status.state).toBe('IN_SPEC')
  })

  it('classifies unlabeled open issue as IDEA_PENDING_APPROVAL with unrouted owner', async () => {
    const res = await request(app).get('/api/tasks')
    const task = (res.body as TaskItem[]).find(t => t.task_id === 'gh-ao-dashboard-201')
    expect(task).toBeDefined()
    expect(task!.status.state).toBe('IDEA_PENDING_APPROVAL')
    expect(task!.status.current_owner).toBe('unrouted')
  })

  it('classifies issue with no labels as IDEA_PENDING_APPROVAL with unrouted owner', async () => {
    const res = await request(app).get('/api/tasks')
    const task = (res.body as TaskItem[]).find(t => t.task_id === 'gh-ao-dashboard-205')
    expect(task).toBeDefined()
    expect(task!.status.state).toBe('IDEA_PENDING_APPROVAL')
    expect(task!.status.current_owner).toBe('unrouted')
  })

  it('classifies other agent label as IDEA_PENDING_APPROVAL with that agent as owner', async () => {
    const res = await request(app).get('/api/tasks')
    const task = (res.body as TaskItem[]).find(t => t.task_id === 'gh-ao-dashboard-202')
    expect(task).toBeDefined()
    expect(task!.status.state).toBe('IDEA_PENDING_APPROVAL')
    expect(task!.status.current_owner).toBe('hephaestus')
  })

  it('classifies agent:backlog issue as APPROVED', async () => {
    const res = await request(app).get('/api/tasks')
    const task = (res.body as TaskItem[]).find(t => t.task_id === 'gh-ao-dashboard-203')
    expect(task).toBeDefined()
    expect(task!.status.state).toBe('APPROVED')
  })

  it('classifies closed issue as DONE regardless of labels', async () => {
    const res = await request(app).get('/api/tasks')
    const task = (res.body as TaskItem[]).find(t => t.task_id === 'gh-ao-dashboard-204')
    expect(task).toBeDefined()
    expect(task!.status.state).toBe('DONE')
  })

  it('preserves response shape for all task types', async () => {
    const res = await request(app).get('/api/tasks')
    const tasks: TaskItem[] = res.body

    for (const t of tasks.filter(t => t.task_id.startsWith('gh-'))) {
      expect(t).toHaveProperty('task_id')
      expect(t).toHaveProperty('contract')
      expect(t).toHaveProperty('contract.title')
      expect(t).toHaveProperty('status')
      expect(t).toHaveProperty('status.state')
      expect(t).toHaveProperty('status.current_owner')
      expect(t).toHaveProperty('status.current_route')
      expect(t).toHaveProperty('status.blockers')
      expect(t).toHaveProperty('actors')
      expect(Array.isArray(t.actors)).toBe(true)
    }
  })
})
