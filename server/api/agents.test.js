import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  aggregateAgentEvents,
  extractLatestSessionMeta,
} from './agents.js'

test('extractLatestSessionMeta returns the newest session metadata for an agent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agents-session-'))
  const sessionsFile = join(root, 'sessions.json')

  await writeFile(
    sessionsFile,
    JSON.stringify(
      {
        'agent:platon:telegram:group:-1003692383088:topic:3416': {
          updatedAt: 2,
          sessionId: 'session-b',
          deliveryContext: { threadId: 3416 },
          systemPromptReport: {
            workspaceDir: '/tmp/workspace-b',
            sessionKey: 'agent:platon:telegram:group:-1003692383088:topic:3416',
          },
        },
        'agent:platon:main': {
          updatedAt: 1,
          sessionId: 'session-a',
          systemPromptReport: {
            workspaceDir: '/tmp/workspace-a',
            sessionKey: 'agent:platon:main',
          },
        },
      },
      null,
      2,
    ),
  )

  const meta = await extractLatestSessionMeta(sessionsFile)

  assert.deepEqual(meta, {
    session_key: 'agent:platon:telegram:group:-1003692383088:topic:3416',
    workspace_path: '/tmp/workspace-b',
    topic_id: 3416,
  })
})

test('aggregateAgentEvents reads events across task folders, filters by actor, skips bad lines, and sorts newest first', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agents-events-'))
  const activeTask = join(root, 'tsk_active')
  const archivedTask = join(root, 'archive', 'tsk_archived')

  await mkdir(activeTask, { recursive: true })
  await mkdir(archivedTask, { recursive: true })

  await writeFile(
    join(activeTask, 'events.ndjson'),
    [
      JSON.stringify({ event_id: 'evt-1', actor: 'platon', timestamp: '2026-03-20T20:00:00.000Z', event_type: 'A' }),
      JSON.stringify({ event_id: 'evt-2', actor: 'archimedes', timestamp: '2026-03-20T21:00:00.000Z', event_type: 'B' }),
      '{bad json',
    ].join('\n'),
  )

  await writeFile(
    join(archivedTask, 'events.ndjson'),
    [
      JSON.stringify({ event_id: 'evt-3', actor: 'platon', timestamp: '2026-03-20T22:00:00.000Z', event_type: 'C' }),
      JSON.stringify({ event_id: 'evt-4', actor: 'platon', timestamp: '2026-03-20T19:00:00.000Z', event_type: 'D' }),
    ].join('\n'),
  )

  const events = await aggregateAgentEvents(root, 'platon')

  assert.deepEqual(
    events.map((event) => event.event_id),
    ['evt-3', 'evt-1', 'evt-4'],
  )
  assert.equal(events.every((event) => event.actor === 'platon'), true)
})
