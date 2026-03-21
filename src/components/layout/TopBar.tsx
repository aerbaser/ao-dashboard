import { useEffect, useState } from 'react'

interface GlobalStatus {
  gateway_up: boolean
  agents_alive: number
  agents_total: number
  active_tasks: number
  blocked_tasks: number
  stuck_tasks: number
  failed_tasks: number
  failed_services: number
  cpu_percent: number
  cpu_temp: number
  claude_usage_percent: number
  codex_usage_percent: number
}

const POLL_INTERVAL = 5_000

export default function TopBar() {
  const [status, setStatus] = useState<GlobalStatus | null>(null)

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch('/api/status')
        if (res.ok && active) {
          setStatus(await res.json())
        }
      } catch {
        // Silently retry on next interval
      }
    }

    poll()
    const id = setInterval(poll, POLL_INTERVAL)
    return () => { active = false; clearInterval(id) }
  }, [])

  if (!status) return <div className="topbar">Loading…</div>

  return (
    <div className="topbar" style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.5rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
      <span>GW: {status.gateway_up ? '●' : '○'}</span>
      <span>Agents: {status.agents_alive}/{status.agents_total}</span>
      <span>Tasks: {status.active_tasks} active</span>
      {status.blocked_tasks > 0 && <span>⚠ {status.blocked_tasks} blocked</span>}
      {status.failed_tasks > 0 && <span>✗ {status.failed_tasks} failed</span>}
      <span>CPU: {status.cpu_percent}%</span>
      <span>Temp: {status.cpu_temp}°C</span>
      <span>Claude: {status.claude_usage_percent}%</span>
      <span>Codex: {status.codex_usage_percent}%</span>
    </div>
  )
}
