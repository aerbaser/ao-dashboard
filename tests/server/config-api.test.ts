// @vitest-environment node
import express from 'express'
import request from 'supertest'
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string
let app: express.Express
let originalHome: string

beforeAll(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'config-api-test-'))
  originalHome = process.env.HOME || ''
  process.env.HOME = tempDir

  await mkdir(join(tempDir, '.openclaw', 'shared-memory'), { recursive: true })
  await writeFile(
    join(tempDir, '.openclaw', 'openclaw.json'),
    JSON.stringify({
      apiKey: 'top-secret',
      nested: { bearerToken: 'secret-token', safe: 'ok' },
      plain: 'visible',
    }),
  )
  await writeFile(
    join(tempDir, '.openclaw', 'shared-memory', 'team-manifest.md'),
    '# Team Manifest\n\n- sokrat\n',
  )

  const { default: configRouter } = await import('../../server/api/config.js')
  app = express()
  app.use('/api/config', configRouter)
})

afterAll(async () => {
  process.env.HOME = originalHome
  await rm(tempDir, { recursive: true, force: true })
})

describe('config API smoke', () => {
  it('GET /api/config/gateway returns redacted config JSON', async () => {
    const res = await request(app).get('/api/config/gateway')
    expect(res.status).toBe(200)
    expect(res.body.apiKey).toBe('••••••••')
    expect(res.body.nested.bearerToken).toBe('••••••••')
    expect(res.body.nested.safe).toBe('ok')
    expect(res.body.plain).toBe('visible')
  })

  it('GET /api/config/team-manifest returns markdown payload', async () => {
    const res = await request(app).get('/api/config/team-manifest')
    expect(res.status).toBe(200)
    expect(res.body.content).toContain('# Team Manifest')
    expect(res.body.content).toContain('sokrat')
  })
})
