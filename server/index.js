// AO Dashboard — Express server (port 3333)
import express from 'express'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import agentsRouter, { getAgentEvents } from './api/agents.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT ?? 3333

app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'ao-dashboard', ts: new Date().toISOString() })
})

// Agent API routes
app.use('/api/agents', agentsRouter)

// Events endpoint aggregated from task event logs for /api/events?agent=X
app.get('/api/events', async (req, res) => {
  const agentId = typeof req.query.agent === 'string' ? req.query.agent : null
  if (!agentId) {
    return res.status(400).json({ error: 'agent query param is required' })
  }

  try {
    const events = await getAgentEvents(agentId)
    res.json(events)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Static client (prod)
app.use(express.static(join(__dirname, '../dist/client')))
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, '../dist/client/index.html'))
})

app.listen(PORT, () => {
  console.log(`[ao-dashboard] server listening on :${PORT}`)
})
