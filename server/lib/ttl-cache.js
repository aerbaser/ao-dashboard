export function createTtlCache({ maxEntries = 64, now = () => Date.now() } = {}) {
  const store = new Map()

  function evictExpired(key, entry) {
    if (!entry) {
      return undefined
    }

    if (now() > entry.expiresAt) {
      store.delete(key)
      return undefined
    }

    return entry
  }

  return {
    get(key) {
      const entry = evictExpired(key, store.get(key))
      if (!entry) {
        return undefined
      }

      store.delete(key)
      store.set(key, entry)
      return entry.value
    },

    set(key, value, ttlMs) {
      const expiresAt = now() + ttlMs

      if (store.has(key)) {
        store.delete(key)
      }

      store.set(key, { value, expiresAt })

      while (store.size > maxEntries) {
        const oldestKey = store.keys().next().value
        if (oldestKey === undefined) {
          break
        }
        store.delete(oldestKey)
      }

      return value
    },

    delete(key) {
      store.delete(key)
    },

    clear() {
      store.clear()
    },
  }
}
