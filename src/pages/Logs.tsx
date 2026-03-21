import { useState, useEffect, useCallback } from 'react'
import LogViewer from '../components/logs/LogViewer'
import DecisionTrail from '../components/logs/DecisionTrail'
import EventStream from '../components/logs/EventStream'
import { getGatewayLog, getWorkerList, getWorkerLog, type WorkerFile } from '../lib/api'

type Tab = 'gateway' | 'workers' | 'decisions' | 'events'

const POLL_INTERVAL = 5000

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function Logs() {
  const [activeTab, setActiveTab] = useState<Tab>('gateway')

  // Gateway state
  const [gatewayLines, setGatewayLines] = useState<string[]>([])
  const [gatewayError, setGatewayError] = useState<string | null>(null)
  const [gatewayLoading, setGatewayLoading] = useState(true)
  const [paused, setPaused] = useState(false)

  // Worker state
  const [workerFiles, setWorkerFiles] = useState<WorkerFile[]>([])
  const [selectedWorker, setSelectedWorker] = useState<string>('')
  const [workerLines, setWorkerLines] = useState<string[]>([])
  const [workerLoading, setWorkerLoading] = useState(false)
  const [workerError, setWorkerError] = useState<string | null>(null)

  // Gateway polling
  const fetchGateway = useCallback(async () => {
    try {
      const data = await getGatewayLog(200)
      if (data.error) {
        setGatewayError(data.error)
        setGatewayLines([])
      } else {
        setGatewayLines(data.lines)
        setGatewayError(null)
      }
    } catch (err) {
      setGatewayError(err instanceof Error ? err.message : 'Failed to load logs')
    } finally {
      setGatewayLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'gateway') return
    if (paused) return

    fetchGateway()

    const id = setInterval(fetchGateway, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [activeTab, paused, fetchGateway])

  // Worker file list
  useEffect(() => {
    if (activeTab !== 'workers') return
    getWorkerList()
      .then((data) => setWorkerFiles(data.files))
      .catch(() => setWorkerFiles([]))
  }, [activeTab])

  // Worker log fetch
  useEffect(() => {
    if (!selectedWorker) {
      setWorkerLines([])
      return
    }
    setWorkerLoading(true)
    setWorkerError(null)
    getWorkerLog(selectedWorker, 100)
      .then((data) => {
        setWorkerLines(data.lines)
        setWorkerError(null)
      })
      .catch((err) => {
        setWorkerError(err instanceof Error ? err.message : 'Failed to load log')
        setWorkerLines([])
      })
      .finally(() => setWorkerLoading(false))
  }, [selectedWorker])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'gateway', label: 'Gateway' },
    { key: 'workers', label: 'Workers' },
    { key: 'decisions', label: 'Decisions' },
    { key: 'events', label: 'Events' },
  ]

  return (
    <div className="flex flex-col h-screen bg-bg-base">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h1 className="text-lg font-semibold text-text-primary">Logs</h1>
        {activeTab === 'gateway' && (
          <button
            onClick={() => setPaused((p) => !p)}
            className={`px-3 py-1 rounded-sm text-xs font-mono font-semibold transition-colors ${
              paused
                ? 'bg-accent-emerald-subtle text-accent-emerald'
                : 'bg-accent-amber-subtle text-accent-amber'
            }`}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle bg-bg-surface">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === key
                ? 'border-accent-amber text-text-primary'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'gateway' && (
          <LogViewer
            lines={gatewayLines}
            loading={gatewayLoading}
            error={gatewayError ?? undefined}
            paused={paused}
          />
        )}

        {activeTab === 'workers' && (
          <div className="flex flex-col h-full">
            {/* Worker file selector */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-bg-surface">
              <select
                value={selectedWorker}
                onChange={(e) => setSelectedWorker(e.target.value)}
                className="bg-bg-void border border-border text-text-primary text-xs font-mono px-2 py-1 rounded-sm flex-1 max-w-xs"
              >
                <option value="">Select a worker log…</option>
                {workerFiles.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} ({formatBytes(f.size_bytes)})
                  </option>
                ))}
              </select>
              {workerFiles.length === 0 && (
                <span className="text-xs text-text-tertiary">No worker log files found</span>
              )}
            </div>
            <div className="flex-1 min-h-0">
              {selectedWorker ? (
                <LogViewer
                  lines={workerLines}
                  loading={workerLoading}
                  error={workerError ?? undefined}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
                  Select a worker log file to view
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'decisions' && <DecisionTrail />}

        {activeTab === 'events' && <EventStream />}
      </div>
    </div>
  )
}
