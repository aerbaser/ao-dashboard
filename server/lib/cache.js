// Server-side TTL cache using Map<string, { data, expires_at }>
// No external dependencies — simple in-memory cache for /api/status and friends.

/** @type {Map<string, { data: unknown, expires_at: number }>} */
const store = new Map()

/**
 * Get a cached value. Returns undefined if missing or expired.
 * @param {string} key
 * @returns {unknown | undefined}
 */
export function get(key) {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expires_at) {
    store.delete(key)
    return undefined
  }
  return entry.data
}

/**
 * Set a cached value with TTL in milliseconds.
 * @param {string} key
 * @param {unknown} data
 * @param {number} ttlMs
 */
export function set(key, data, ttlMs) {
  store.set(key, { data, expires_at: Date.now() + ttlMs })
}

/**
 * Check if a non-expired entry exists.
 * @param {string} key
 * @returns {boolean}
 */
export function has(key) {
  return get(key) !== undefined
}
