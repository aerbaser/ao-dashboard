// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import servicesRouter, {
  createServicesRouter,
  isForbiddenService,
  SERVICE_META,
} from '../../server/api/services.js'
import cronRouter, {
  createCronRouter,
  isValidCronExpression,
  parseCrontab,
} from '../../server/api/cron.js'
import vitalsRouter, { createVitalsRouter } from '../../server/api/vitals.js'
import rateLimitsRouter, { normalizeRateLimitProfiles } from '../../server/api/rate-limits.js'
import { createStatsRouter } from '../../server/api/stats.js'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/services', servicesRouter)
  app.use('/api/cron', cronRouter)
  app.use('/api/vitals', vitalsRouter)
  app.use('/api/rate-limits', rateLimitsRouter)
  return app
}

describe('system APIs', () => {
  it('exports service metadata for all required groups', () => {
    expect(SERVICE_META['dashboard-server']).toMatchObject({ group: 'Core' })
    expect(SERVICE_META['ao@sokrat-core']).toMatchObject({ group: 'Agents' })
    expect(SERVICE_META['codex-proxy']).toMatchObject({ group: 'Integrations' })
  })

  it('matches forbidden services including openclaw-gateway compatibility guard', () => {
    expect(isForbiddenService('tg-news-runner', ['tg-news-*'])).toBe(true)
    expect(isForbiddenService('openclaw-gateway', [])).toBe(true)
    expect(isForbiddenService('dashboard-server', [])).toBe(false)
  })

  it('rejects forbidden service actions with HTTP 403', async () => {
    const app = express()
    app.use(express.json())
    app.use(
      '/api/services',
      createServicesRouter({
        readForbiddenNames: vi.fn().mockResolvedValue(['openclaw-gateway']),
        getServicesSnapshot: vi.fn().mockResolvedValue([]),
        runSystemctlAction: vi.fn(),
        appendAuditLog: vi.fn(),
      }),
    )

    const response = await request(app).post('/api/services/openclaw-gateway/restart')

    expect(response.status).toBe(403)
    expect(response.body.error).toContain('forbidden')
  })

  it('validates cron expressions and rejects invalid updates', async () => {
    const app = express()
    app.use(express.json())
    app.use(
      '/api/cron',
      createCronRouter({
        readCrontab: vi.fn().mockResolvedValue('0 3 * * * echo test'),
        writeCrontab: vi.fn(),
      }),
    )

    const response = await request(app)
      .post('/api/cron')
      .send({ entries: [{ schedule: 'invalid', command: 'echo test', enabled: true }] })

    expect(response.status).toBe(400)
    expect(response.body.error).toContain('cron')
    expect(isValidCronExpression('*/5 * * * *')).toBe(true)
    expect(isValidCronExpression('invalid')).toBe(false)
  })

  it('parses current crontab lines into structured entries', () => {
    const parsed = parseCrontab([
      '# comment',
      '*/10 * * * * /path/to/job',
      '# disabled-job',
      '# 0 3 * * * /path/to/off',
    ].join('\n'))

    expect(parsed.entries).toHaveLength(2)
    expect(parsed.entries[0]).toMatchObject({
      schedule: '*/10 * * * *',
      enabled: true,
    })
    expect(parsed.entries[1]).toMatchObject({
      enabled: false,
      schedule: '0 3 * * *',
    })
  })

  it('returns vitals with 16 cpu cores', async () => {
    const app = express()
    app.use(
      '/api/vitals',
      createVitalsRouter({
        collectVitals: vi.fn().mockResolvedValue({
          cpu: { overall: 24, temperature: 61, per_core: new Array(16).fill(25) },
          memory: { used_mb: 1024, total_mb: 4096, top_processes: [] },
          disk: { used_mb: 10000, total_mb: 20000, key_dirs: [] },
          load: { one: 0.5, five: 0.6, fifteen: 0.7 },
          tailscale_ip: '100.64.0.1',
          uptime_seconds: 1234,
        }),
      }),
    )

    const response = await request(app).get('/api/vitals')

    expect(response.status).toBe(200)
    expect(response.body.cpu.per_core).toHaveLength(16)
  })

  it('normalizes rate-limit profiles into the three display rows', () => {
    const normalized = normalizeRateLimitProfiles([
      {
        profile: 'yura',
        tokens_used: 70,
        tokens_limit: 100,
        requests_used: 7,
        requests_limit: 10,
        reset_at: '2026-03-21T09:00:00.000Z',
        model: 'claude-3-7-sonnet',
      },
      {
        profile: 'dima',
        tokens_used: 10,
        tokens_limit: 100,
        requests_used: 1,
        requests_limit: 10,
        reset_at: '2026-03-21T09:00:00.000Z',
        model: 'claude-3-7-sonnet',
      },
      {
        profile: 'codex',
        tokens_used: 5,
        tokens_limit: 20,
        requests_used: 1,
        requests_limit: 5,
        reset_at: '2026-03-21T09:00:00.000Z',
        model: 'gpt-4.1',
      },
    ])

    expect(normalized.map((entry) => entry.label)).toEqual([
      'Claude yura/Max',
      'Claude dima/fallback',
      'Codex Pro',
    ])
  })

  it('wires the default routers without throwing', async () => {
    const app = buildApp()
    const response = await request(app).get('/api/rate-limits')
    expect(response.status).toBeLessThan(500)
  })

  // ─── Throughput stats ────────────────────────────────────────────────────

  it('returns throughput stats with completed tasks counted correctly', async () => {
    const now = Date.now()
    const app = express()
    app.use(
      '/api/stats',
      createStatsRouter({
        getLocalTasks: () => [
          { id: 'tsk_1', state: 'DONE', createdAt: now - 3 * 3600_000, completedAt: now - 1000 },
          { id: 'tsk_2', state: 'DONE', createdAt: now - 48 * 3600_000, completedAt: now - 25 * 3600_000 },
          { id: 'tsk_3', state: 'EXECUTION', createdAt: now - 1000, completedAt: null },
        ],
        getGitHubTasks: () => Promise.resolve([
          { id: 'gh-1', state: 'DONE', createdAt: now - 2 * 3600_000, completedAt: now - 500 },
        ]),
      }),
    )

    const res = await request(app).get('/api/stats/throughput')

    expect(res.status).toBe(200)
    expect(res.body.completed_24h).toBe(2)   // tsk_1 + gh-1 (within 24h)
    expect(res.body.completed_7d).toBe(3)    // tsk_1 + tsk_2 + gh-1 (within 7d)
    expect(res.body.avg_cycle_time_minutes).toBeGreaterThan(0)
    expect(res.body.median_cycle_time_minutes).toBeGreaterThan(0)
    expect(['shrinking', 'stable', 'growing']).toContain(res.body.backlog_trend)
    expect(res.body.computed_at).toBeTruthy()
  })

  it('handles zero completed tasks without error', async () => {
    const app = express()
    app.use(
      '/api/stats',
      createStatsRouter({
        getLocalTasks: () => [],
        getGitHubTasks: () => Promise.resolve([]),
      }),
    )

    const res = await request(app).get('/api/stats/throughput')

    expect(res.status).toBe(200)
    expect(res.body.completed_24h).toBe(0)
    expect(res.body.completed_7d).toBe(0)
    expect(res.body.avg_cycle_time_minutes).toBe(0)
    expect(res.body.median_cycle_time_minutes).toBe(0)
  })

  it('excludes FAILED tasks from throughput count', async () => {
    const now = Date.now()
    const app = express()
    app.use(
      '/api/stats',
      createStatsRouter({
        getLocalTasks: () => [
          { id: 'tsk_1', state: 'DONE', createdAt: now - 3600_000, completedAt: now - 500 },
          { id: 'tsk_2', state: 'FAILED', createdAt: now - 3600_000, completedAt: now - 500 },
        ],
        getGitHubTasks: () => Promise.resolve([]),
      }),
    )

    const res = await request(app).get('/api/stats/throughput')

    expect(res.status).toBe(200)
    expect(res.body.completed_24h).toBe(1) // only DONE, not FAILED
  })
})
