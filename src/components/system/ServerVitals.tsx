import type { VitalsResponse } from '../../lib/types'

interface ServerVitalsProps {
  vitals: VitalsResponse | null
  loading: boolean
}

function percentClass(value: number) {
  if (value > 85) return 'bg-red'
  if (value > 60) return 'bg-amber'
  return 'bg-emerald'
}

function temperatureTone(value: number) {
  if (value > 85) return 'bg-red-subtle text-red border-red/30'
  if (value >= 70) return 'bg-amber-subtle text-amber border-amber/30'
  return 'bg-emerald-subtle text-emerald border-emerald/30'
}

function toPercent(used: number, total: number) {
  if (total <= 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

function formatUptime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`
}

export default function ServerVitals({ vitals, loading }: ServerVitalsProps) {
  if (loading && !vitals) {
    return <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-sm text-text-tertiary">Loading server vitals…</div>
  }

  if (!vitals) {
    return <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 text-sm text-text-tertiary">Vitals unavailable.</div>
  }

  const ramPercent = toPercent(vitals.memory.used_mb, vitals.memory.total_mb)
  const diskPercent = toPercent(vitals.disk.used_mb, vitals.disk.total_mb)

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Server Vitals</h2>
          <p className="mt-1 text-xs text-text-tertiary">CPU heatmap, memory, disk, load, uptime, and Tailscale reachability.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-sm border px-2 py-1 font-mono text-xs ${temperatureTone(vitals.cpu.temperature)}`}>
            {vitals.cpu.temperature}°C
          </span>
          <span className="rounded-full border border-border-subtle px-2 py-1 font-mono text-xs text-text-secondary">
            {vitals.tailscale_ip ?? 'No Tailscale IP'}
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-4 xl:grid-cols-[1.2fr_0.8fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">CPU</h3>
            <span className="font-mono text-xs text-text-secondary">{vitals.cpu.overall}% overall</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {vitals.cpu.per_core.map((value, index) => (
              <div
                key={index}
                data-testid="cpu-core-cell"
                className={`aspect-square rounded-md ${percentClass(value)} p-2 text-text-inverse`}
              >
                <div className="font-mono text-[11px]">CPU {index + 1}</div>
                <div className="mt-3 font-mono text-lg font-semibold">{value}%</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="rounded-md border border-border-default bg-bg-elevated p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Load</h3>
              <span className="font-mono text-xs text-text-secondary">Uptime {formatUptime(vitals.uptime_seconds)}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 font-mono text-sm text-text-primary">
              <div>{vitals.load.one.toFixed(2)}</div>
              <div>{vitals.load.five.toFixed(2)}</div>
              <div>{vitals.load.fifteen.toFixed(2)}</div>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-3 font-mono text-[11px] uppercase tracking-wide text-text-tertiary">
              <div>1m</div>
              <div>5m</div>
              <div>15m</div>
            </div>
          </div>

          <div className="rounded-md border border-border-default bg-bg-elevated p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">RAM</h3>
              <span className="font-mono text-xs text-text-secondary">
                {vitals.memory.used_mb} / {vitals.memory.total_mb} MB
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-overlay">
              <div className={`h-full ${percentClass(ramPercent)}`} style={{ width: `${ramPercent}%` }} />
            </div>
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-text-tertiary">
                <tr>
                  <th className="pb-2 font-medium">Process</th>
                  <th className="pb-2 font-medium">CPU</th>
                  <th className="pb-2 font-medium">RSS</th>
                </tr>
              </thead>
              <tbody className="font-mono text-text-secondary">
                {vitals.memory.top_processes.map((process) => (
                  <tr key={process.pid}>
                    <td className="py-1 pr-3">{process.name}</td>
                    <td className="py-1 pr-3">{process.cpu_percent.toFixed(1)}%</td>
                    <td className="py-1">{process.memory_mb} MB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border border-border-default bg-bg-elevated p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-tertiary">Disk</h3>
              <span className="font-mono text-xs text-text-secondary">
                {vitals.disk.used_mb} / {vitals.disk.total_mb} MB
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg-overlay">
              <div className={`h-full ${percentClass(diskPercent)}`} style={{ width: `${diskPercent}%` }} />
            </div>
            <div className="mt-3 space-y-2 font-mono text-xs text-text-secondary">
              {vitals.disk.key_dirs.map((entry) => (
                <div key={entry.path} className="flex items-center justify-between gap-3">
                  <span className="truncate">{entry.path}</span>
                  <span>{entry.size_mb} MB</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
