// @vitest-environment node
/**
 * Regression coverage for #149 — pipeline trust edge cases.
 * - All tasks DONE: API must still return valid shape
 * - Missing status.json: task must be skipped or have default state
 * - Missing events.ndjson: actors/lastAgentMessage must be safe defaults
 */
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string, stderr: string) => void) => {
    cb(new Error('skip external in smoke tests'), '', 'skip')
  }),
}))

vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch in smoke tests')))

let tempDir: string
let app: express.Express
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'tasks-edge-'))
  originalHome = process.env.HOME || ''
  process.env.HOME = tempDir

  // Task 1: all DONE
  const task1Dir = join(tempDir, 'clawd', 'tasks', 'tsk_done_001')
  await mkdir(task1Dir, { recursive: true })
  await writeFile(join(task1Dir, 'contract.json'), JSON.stringify({
    title: 'Done task', route: 'build_route', outcome_type: 'app_release',
  }))
  await writeFile(join(task1Dir, 'status.json'), JSON.stringify({
    state: 'DONE', current_owner: 'archimedes', current_route: 'build_route',
    blockers: [], retries: 0, updated_at: '2026-03-31T16:00:00Z',
    last_material_update: '2026-03-31T16:00:00Z',
  }))

  // Task 2: another DONE
  const task2Dir = join(tempDir, 'clawd', 'tasks', 'tsk_done_002')
  await mkdir(task2Dir, { recursive: true })
  await writeFile(join(task2Dir, 'contract.json'), JSON.stringify({
    title: 'Another done task', route: 'artifact_route', outcome_type: 'design_pack',
  }))
  await writeFile(join(task2Dir, 'status.json'), JSON.stringify({
    state: 'DONE', current_owner: 'platon', current_route: 'artifact_route',
    blockers: [], retries: 0, updated_at: '2026-03-30T12:00:00Z',
    last_material_update: '2026-03-30T12:00:00Z',
  }))

  // Task 3: missing status.json (only contract.json exists)
  const task3Dir = join(tempDir, 'clawd', 'tasks', 'tsk_no_status')
  await mkdir(task3Dir, { recursive: true })
  await writeFile(join(task3Dir, 'contract.json'), JSON.stringify({
    title: 'No status task', route: 'build_route', outcome_type: 'app_release',
  }))
  // No status.json — should be skipped gracefully

  // Task 4: has contract+status but no events.ndjson
  const task4Dir = join(tempDir, 'clawd', 'tasks', 'tsk_no_events')
  await mkdir(task4Dir, { recursive: true })
  await writeFile(join(task4Dir, 'contract.json'), JSON.stringify({
    title: 'No events task', route: 'build_route', outcome_type: 'app_release',
  }))
  await writeFile(join(task4Dir, 'status.json'), JSON.stringify({
    state: 'EXECUTION', current_owner: 'archimedes', current_route: 'build_route',
    blockers: [], retries: 0, updated_at: '2026-03-31T16:00:00Z',
    last_material_update: '2026-03-31T16:00:00Z',
  }))
  // No events.ndjson — actors and lastAgentMessage should be safe

  const { default: tasksRouter } = await import('../../server/api/tasks.js')
  app = express()
  app.use(express.json())
  app.use('/api/tasks', tasksRouter)
})

afterAll(async () => {
  process.env.HOME = originalHome
  await rm(tempDir, { recursive: true, force: true })
})

describe('tasks API — edge cases', () => {
  it('GET /api/tasks returns valid array when all tasks are DONE', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    const doneTasks = res.body.filter((t: { status: { state: string } }) => t.status?.state === 'DONE')
    expect(doneTasks.length).toBeGreaterThanOrEqual(2)

    // Each DONE task should have valid shape
    for (const t of doneTasks) {
      expect(t.task_id).toBeTruthy()
      expect(t.contract).toBeDefined()
      expect(t.contract.title).toBeTruthy()
      expect(t.status.state).toBe('DONE')
    }
  })

  it('skips task with missing status.json without crashing', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(200)

    // tsk_no_status should not appear (or appear with safe defaults)
    // The important thing is it doesn't crash the whole response
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(2) // at least the DONE tasks
  })

  it('handles missing events.ndjson gracefully', async () => {
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(200)

    const noEventsTask = res.body.find((t: { task_id: string }) => t.task_id === 'tsk_no_events')
    if (noEventsTask) {
      // actors should be empty array, not crash
      expect(Array.isArray(noEventsTask.actors)).toBe(true)
      // lastAgentMessage should be null, not crash
      expect(noEventsTask.lastAgentMessage).toBeNull()
    }
  })
})
