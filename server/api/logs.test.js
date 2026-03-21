import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import logsRouter from './logs.js'

async function withServer(run) {
  const app = express()
  app.use('/api/logs', logsRouter)
  app.use('/api', logsRouter)

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance))
  })

  const address = server.address()
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    await run(baseUrl)
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

test('GET /api/decisions returns normalized rows from task decision logs', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/decisions`)
    assert.equal(response.status, 200)

    const decisions = await response.json()
    assert.ok(Array.isArray(decisions))
    assert.ok(decisions.length > 0)

    const [firstDecision] = decisions
    assert.equal(typeof firstDecision.task_id, 'string')
    assert.equal(typeof firstDecision.gate_type, 'string')
    assert.equal(typeof firstDecision.agent, 'string')
    assert.equal(typeof firstDecision.timestamp, 'string')
  })
})

test('GET /api/events returns normalized rows from task event logs', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/events`)
    assert.equal(response.status, 200)

    const events = await response.json()
    assert.ok(Array.isArray(events))
    assert.ok(events.length > 0)

    const [firstEvent] = events
    assert.equal(typeof firstEvent.task_id, 'string')
    assert.equal(typeof firstEvent.type, 'string')
    assert.equal(typeof firstEvent.actor, 'string')
    assert.equal(typeof firstEvent.timestamp, 'string')
  })
})
