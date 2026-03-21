// AO Dashboard — Express server (port 3333)
// Wraps task-store.js CLI per §agent-rules: DRY API, no re-implemented logic
import express from 'express'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import tasksRouter from './api/tasks.js'
import statusRouter from './api/status.js'
import rateLimitsRouter from './api/rate-limits.js'
import agentsRouter from './api/agents.js'
import logsRouter from './api/logs.js'
import { getGlobalStatus } from './lib/status.js'
import { startVitalsWorker } from './lib/vitals.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT ?? 3333

app.use(express.json())

// ── Health ───────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ao-dashboard', ts: new Date().toISOString() })
})

// ── Tasks ────────────────────────────────────────────────────────────────

app.use('/api/tasks', tasksRouter)

// ── Legacy status (tasks-based) ──────────────────────────────────────────

app.use('/api/status', statusRouter)

// ── Rate-limits ──────────────────────────────────────────────────────────

app.use('/api/rate-limits', rateLimitsRouter)
app.use('/api/agents', agentsRouter)
app.use('/api/logs', logsRouter)



// ── Global status aggregator (TTL-cached, <200ms target) ─────────────────

app.get('/api/global-status', async (_req, res) => {
  try {
    const status = await getGlobalStatus()
    res.json(status)
  } catch (err) {
    res.status(500).json({ error: 'Status aggregation failed', detail: String(err) })
  }
})

// ── Static client (prod) ─────────────────────────────────────────────────

app.use(express.static(join(__dirname, '../dist/client')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/client/index.html'))
})

// ── Start ────────────────────────────────────────────────────────────────

startVitalsWorker(10_000)

app.listen(PORT, () => {
  console.log(`[ao-dashboard] server listening on :${PORT}`)
})

// ── Decisions + Events (delegated to logs router) ─────────────────────────────
app.get('/api/decisions', async (req, res) => {
  req.url = '/decisions' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')
  logsRouter.handle(req, res, () => res.status(404).json({ error: 'not found' }))
})
app.get('/api/events', async (req, res) => {
  req.url = '/events' + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '')
  logsRouter.handle(req, res, () => res.status(404).json({ error: 'not found' }))
})
