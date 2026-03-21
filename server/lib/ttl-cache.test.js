import test from 'node:test'
import assert from 'node:assert/strict'

import { createTtlCache } from './ttl-cache.js'

test('ttl cache expires entries after their ttl', () => {
  let now = 1_000
  const cache = createTtlCache({ now: () => now })

  cache.set('services', { ok: true }, 50)
  assert.deepEqual(cache.get('services'), { ok: true })

  now = 1_060
  assert.equal(cache.get('services'), undefined)
})

test('ttl cache refreshes recency on get and evicts the oldest entry', () => {
  const cache = createTtlCache({ maxEntries: 2 })

  cache.set('a', 1, 1_000)
  cache.set('b', 2, 1_000)
  assert.equal(cache.get('a'), 1)

  cache.set('c', 3, 1_000)

  assert.equal(cache.get('a'), 1)
  assert.equal(cache.get('b'), undefined)
  assert.equal(cache.get('c'), 3)
})
