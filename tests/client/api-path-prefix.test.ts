import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getDecisions,
  getGatewayLog,
  getLogEvents,
  getWorkerList,
  getWorkerLog,
} from '../../src/lib/api'

function jsonResponse<T>(payload: T): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api path prefix contract', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('composes endpoint URLs with exactly one /api prefix', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ lines: [], file_size_bytes: 0, file_date: '2026-03-26' }))
      .mockResolvedValueOnce(jsonResponse({ files: [] }))
      .mockResolvedValueOnce(jsonResponse({ lines: [], file_size_bytes: 0, file_name: 'worker.log' }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))

    await getGatewayLog(50)
    await getWorkerList()
    await getWorkerLog('worker 1', 20)
    await getDecisions({ agent: 'codex', task_id: 'task-1' })
    await getLogEvents({ agent: 'codex', task_id: 'task-1', type: 'STATE_CHANGED' })

    const urls = fetchMock.mock.calls.map(([url]) => String(url))

    expect(urls).toEqual([
      '/api/logs/gateway?lines=50',
      '/api/logs/worker',
      '/api/logs/worker/worker%201?lines=20',
      '/api/decisions?agent=codex&task_id=task-1',
      '/api/events?agent=codex&task_id=task-1&type=STATE_CHANGED',
    ])

    urls.forEach((url) => {
      expect(url).not.toContain('/api/api/')
    })
  })

  it('keeps fetchJson call paths base-relative (no /api prefix)', () => {
    const source = readFileSync(resolve(__dirname, '../../src/lib/api.ts'), 'utf8')
    expect(source).not.toMatch(/fetchJson\s*(?:<[^>]+>)?\(\s*[`'"]\/api/)
  })
})
