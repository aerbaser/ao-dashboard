import express from 'express'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import logsRouter from './api/logs.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT ?? 3333

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ao-dashboard', ts: new Date().toISOString() })
})

// Log & data routes
app.use('/api/logs', logsRouter)
app.use('/api', logsRouter) // mounts /decisions and /events at /api/decisions, /api/events

// Static client (prod)
app.use(express.static(join(__dirname, '../dist/client')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/client/index.html'))
})

app.listen(PORT, () => {
  console.log(`[ao-dashboard] server listening on :${PORT}`)
})
