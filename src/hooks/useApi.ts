import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from './useToast'

interface UseApiResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useApi<T>(url: string, intervalMs?: number): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { push } = useToast()
  const isFirstFetch = useRef(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      const json = (await res.json()) as T
      setData(json)
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed'
      setError(msg)
      push(msg, 'error')
    } finally {
      if (isFirstFetch.current) {
        isFirstFetch.current = false
        setLoading(false)
      }
    }
  }, [url, push])

  const refetch = useCallback(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    isFirstFetch.current = true
    setLoading(true)
    void fetchData()
    if (!intervalMs) return
    const id = setInterval(() => { void fetchData() }, intervalMs)
    return () => clearInterval(id)
  }, [fetchData, intervalMs])

  return { data, loading, error, refetch }
}
