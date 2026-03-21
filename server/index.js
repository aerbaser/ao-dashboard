// AO Dashboard — Express server (port 3333)
// Wraps task-store.js CLI per §agent-rules: DRY API, no re-implemented logic
import express from 'express'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import rateLimitsRouter from './api/rate-limits.js'
import tasksRouter from './api/tasks.js'
import createStatusRouter from './api/status.js'
import { createTtlCache } from './lib/ttl-cache.js'
import { createVitalsMonitor } from './lib/vitals.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT ?? 3333
const cache = createTtlCache({ maxEntries: 32 })
const vitalsMonitor = createVitalsMonitor({ intervalMs: 10_000 })

app.use(express.json())
vitalsMonitor.start()

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ao-dashboard', ts: new Date().toISOString() })
})

app.use('/api/tasks', tasksRouter)
app.use('/api/rate-limits', rateLimitsRouter)
app.use('/api/status', createStatusRouter({ cache, vitalsMonitor }))

// Static client (prod)
app.use(express.static(join(__dirname, '../dist/client')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/client/index.html'))
})

app.listen(PORT, () => {
  console.log(`[ao-dashboard] server listening on :${PORT}`)
})
