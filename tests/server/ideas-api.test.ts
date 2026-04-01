// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let app: express.Express
let tempDir: string
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'ideas-api-test-'))
  mkdirSync(join(tempDir, 'clawd', 'ideas'), { recursive: true })
  mkdirSync(join(tempDir, 'clawd', 'tasks'), { recursive: true })
  mkdirSync(join(tempDir, 'clawd', 'scripts'), { recursive: true })

  await writeFile(join(tempDir, 'clawd', 'scripts', 'task-store.js'), `
const fs = require('fs')
const path = require('path')

const HOME = process.env.HOME
const TASKS_DIR = path.join(HOME, 'clawd', 'tasks')
let counter = 0

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function append(file, entry) {
  fs.appendFileSync(file, JSON.stringify(entry) + '\\n', 'utf8')
}

ensureDir(TASKS_DIR)

const [, , cmd, ...args] = process.argv

if (cmd === 'create') {
  const titleIdx = args.indexOf('--title')
  const routeIdx = args.indexOf('--route')
  const outcomeIdx = args.indexOf('--outcome')
  const title = titleIdx >= 0 ? args[titleIdx + 1] : 'Untitled'
  const route = routeIdx >= 0 ? args[routeIdx + 1] : 'artifact_route'
  const outcome = outcomeIdx >= 0 ? args[outcomeIdx + 1] : 'strategy_doc'

  if (title.includes('fail-routing')) {
    console.error('CREATE_FAILED: simulated routing failure')
    process.exit(1)
  }

  counter += 1
  const taskId = 'tsk_test_' + String(counter).padStart(3, '0')
  const taskDir = path.join(TASKS_DIR, taskId)
  ensureDir(taskDir)
  fs.writeFileSync(path.join(taskDir, 'contract.json'), JSON.stringify({
    schema_version: '1.0',
    task_id: taskId,
    title,
    raw_request: title,
    outcome_type: outcome,
    delivery_mode: 'repo_build',
    route,
    full_solution: true,
    approval_policy: 'delegated_timeout',
    created_at: new Date().toISOString(),
  }, null, 2))
  fs.writeFileSync(path.join(taskDir, 'status.json'), JSON.stringify({
    schema_version: '1.0',
    task_id: taskId,
    state: 'PLANNING',
    current_owner: 'platon',
    current_route: route,
    blockers: [],
    retries: 0,
    updated_at: new Date().toISOString(),
    last_material_update: new Date().toISOString(),
    next_action: 'Await routing handoff',
  }, null, 2))
  console.log('✅ Task created: ' + taskId)
  process.exit(0)
}

if (cmd === 'decision') {
  const [taskId, dataStr] = args
  const taskDir = path.join(TASKS_DIR, taskId)
  ensureDir(taskDir)
  append(path.join(taskDir, 'decision-log.jsonl'), { task_id: taskId, ...JSON.parse(dataStr || '{}') })
  console.log('✅ Decision logged')
  process.exit(0)
}

if (cmd === 'event') {
  const [taskId, type, dataStr] = args
  const taskDir = path.join(TASKS_DIR, taskId)
  ensureDir(taskDir)
  append(path.join(taskDir, 'events.ndjson'), { task_id: taskId, event_type: type, ...JSON.parse(dataStr || '{}') })
  console.log('✅ Event appended')
  process.exit(0)
}

console.log('OK')
`, 'utf8')

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

async function writeIdea(data: Record<string, unknown>) {
  await writeFile(
    join(tempDir, 'clawd', 'ideas', `${data.id}.json`),
    JSON.stringify(data, null, 2),
  )
}

async function readIdea(id: string) {
  return JSON.parse(await readFile(join(tempDir, 'clawd', 'ideas', `${id}.json`), 'utf8'))
}

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

describe('Ideas approval queue', () => {
  it('lists explicit and legacy approval-needed ideas in the queue', async () => {
    await writeIdea({
      id: 'idea_20260401_aaaaaa',
      title: 'Approval record',
      body: 'Needs a decision',
      status: 'draft',
      tags: [],
      target_agent: 'platon',
      created_at: '2026-04-01T09:00:00Z',
      updated_at: '2026-04-01T10:00:00Z',
      approval: {
        state: 'pending',
        requested_at: '2026-04-01T09:30:00Z',
        reason: 'Need explicit product approval',
        route: 'artifact_route',
        expected_outcome: 'strategy_doc',
        owner: 'platon',
        next_action: 'Await operator decision',
      },
    })
    await writeIdea({
      id: 'idea_20260401_bbbbbb',
      title: 'Artifact ready legacy',
      body: 'Ready to route',
      status: 'artifact_ready',
      tags: [],
      target_agent: 'platon',
      created_at: '2026-04-01T08:00:00Z',
      updated_at: '2026-04-01T08:30:00Z',
      artifact_md: '# Spec',
    })
    await writeIdea({
      id: 'idea_20260401_cccccc',
      title: 'Reviewed legacy',
      body: 'Old approval flow',
      status: 'reviewed',
      tags: [],
      target_agent: 'platon',
      created_at: '2026-04-01T07:00:00Z',
      updated_at: '2026-04-01T07:15:00Z',
      review_note: 'Needs Yura approval before routing',
      reviewed_at: '2026-04-01T07:10:00Z',
    })

    const res = await request(app).get('/api/ideas/approval-queue')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(3)
    expect(res.body.map((item: { id: string }) => item.id)).toEqual([
      'idea_20260401_aaaaaa',
      'idea_20260401_bbbbbb',
      'idea_20260401_cccccc',
    ])
    expect(res.body[1]).toMatchObject({
      approval_state: 'pending',
      owner: 'platon',
      route: 'artifact_route',
      expected_outcome: 'strategy_doc',
    })
    expect(res.body[2].why).toContain('Needs Yura approval')
  })

  it('returns an empty array when no ideas need approval', async () => {
    const res = await request(app).get('/api/ideas/approval-queue')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('persists Later, No, and Rescope decisions durably on the idea', async () => {
    await writeIdea({
      id: 'idea_20260401_dddddd',
      title: 'Decision target',
      body: 'Needs a call',
      status: 'draft',
      tags: [],
      target_agent: 'platon',
      created_at: '2026-04-01T09:00:00Z',
      updated_at: '2026-04-01T09:00:00Z',
      approval: {
        state: 'pending',
        requested_at: '2026-04-01T09:00:00Z',
        reason: 'Need explicit approval',
        route: 'artifact_route',
        expected_outcome: 'strategy_doc',
        owner: 'platon',
        next_action: 'Await operator decision',
      },
    })

    for (const [decision, expectedState] of [['later', 'later'], ['no', 'no'], ['rescope', 'rescope']] as const) {
      const reset = await readIdea('idea_20260401_dddddd')
      reset.approval.state = 'pending'
      delete reset.approval.decided_at
      delete reset.approval.decided_by
      delete reset.approval.decision_note
      await writeIdea(reset)

      const res = await request(app)
        .post('/api/ideas/idea_20260401_dddddd/decision')
        .send({ decision, note: `operator-${decision}` })

      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ approval_state: expectedState })

      const saved = await readIdea('idea_20260401_dddddd')
      expect(saved.approval).toMatchObject({
        state: expectedState,
        decided_by: 'dashboard',
        decision_note: `operator-${decision}`,
      })
    }
  })

  it('routes Yes through real task creation and records the task id', async () => {
    await writeIdea({
      id: 'idea_20260401_eeeeee',
      title: 'Route me',
      body: 'Should create a task',
      status: 'draft',
      tags: [],
      target_agent: 'platon',
      created_at: '2026-04-01T09:00:00Z',
      updated_at: '2026-04-01T09:00:00Z',
      approval: {
        state: 'pending',
        requested_at: '2026-04-01T09:00:00Z',
        reason: 'Need explicit approval',
        route: 'artifact_route',
        expected_outcome: 'strategy_doc',
        owner: 'platon',
        next_action: 'Await operator decision',
      },
    })

    const res = await request(app)
      .post('/api/ideas/idea_20260401_eeeeee/decision')
      .send({ decision: 'yes', note: 'Ship it' })

    expect(res.status).toBe(200)
    expect(res.body.approval_state).toBe('routed')
    expect(res.body.task_id).toMatch(/^tsk_test_/)

    const saved = await readIdea('idea_20260401_eeeeee')
    expect(saved.status).toBe('approved')
    expect(saved.task_id).toMatch(/^tsk_test_/)
    expect(saved.approval).toMatchObject({
      state: 'routed',
      task_id: saved.task_id,
      decided_by: 'dashboard',
      decision_note: 'Ship it',
    })
  })

  it('rejects stale duplicate Yes decisions after routing already happened', async () => {
    const res = await request(app)
      .post('/api/ideas/idea_20260401_eeeeee/decision')
      .send({ decision: 'yes', note: 'again' })

    expect(res.status).toBe(409)
    expect(res.body.error).toBe('STALE_DECISION')
  })

  it('concurrent Yes decisions route exactly once (no duplicate-task race)', async () => {
    await writeIdea({
      id: 'idea_20260401_abc001',
      title: 'Concurrent route target',
      body: 'Race test',
      status: 'draft',
      tags: [],
      target_agent: 'platon',
      created_at: '2026-04-01T10:00:00Z',
      updated_at: '2026-04-01T10:00:00Z',
      approval: {
        state: 'pending',
        requested_at: '2026-04-01T10:00:00Z',
        reason: 'Need explicit approval',
        route: 'artifact_route',
        expected_outcome: 'strategy_doc',
        owner: 'platon',
        next_action: 'Await operator decision',
      },
    })

    // Fire two Yes decisions concurrently — exactly one must succeed (200) and
    // the other must be rejected (409 STALE_DECISION).
    const [r1, r2] = await Promise.all([
      request(app).post('/api/ideas/idea_20260401_abc001/decision').send({ decision: 'yes', note: 'first' }),
      request(app).post('/api/ideas/idea_20260401_abc001/decision').send({ decision: 'yes', note: 'second' }),
    ])

    const statuses = [r1.status, r2.status].sort()
    expect(statuses).toEqual([200, 409])

    const winner = r1.status === 200 ? r1 : r2
    expect(winner.body.approval_state).toBe('routed')
    expect(winner.body.task_id).toMatch(/^tsk_test_/)

    const saved = await readIdea('idea_20260401_abc001')
    expect(saved.approval.state).toBe('routed')
    // Only one task was created
    expect(saved.task_id).toMatch(/^tsk_test_/)
  })

  it('persists routing failure truthfully when task creation fails', async () => {
    await writeIdea({
      id: 'idea_20260401_ffffff',
      title: 'fail-routing approval',
      body: 'Should fail',
      status: 'draft',
      tags: [],
      target_agent: 'platon',
      created_at: '2026-04-01T09:00:00Z',
      updated_at: '2026-04-01T09:00:00Z',
      approval: {
        state: 'pending',
        requested_at: '2026-04-01T09:00:00Z',
        reason: 'Need explicit approval',
        route: 'artifact_route',
        expected_outcome: 'strategy_doc',
        owner: 'platon',
        next_action: 'Await operator decision',
      },
    })

    const res = await request(app)
      .post('/api/ideas/idea_20260401_ffffff/decision')
      .send({ decision: 'yes', note: 'try route' })

    expect(res.status).toBe(502)
    expect(res.body.error).toBe('ROUTING_FAILED')

    const saved = await readIdea('idea_20260401_ffffff')
    expect(saved.approval.state).toBe('routing_failed')
    expect(saved.approval.error).toContain('CREATE_FAILED')
    expect(saved.task_id ?? null).toBeNull()
  })
})
