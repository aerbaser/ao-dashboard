// CPU and thermal vitals — pre-computed snapshot updated every 10s.
// Avoids blocking reads on every /api/status poll.
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

let cpuPercent = 0
let cpuTemp = 0
let prevIdle = 0
let prevTotal = 0

async function readCpuTimes() {
  try {
    const raw = await readFile('/proc/stat', 'utf8')
    const line = raw.split('\n')[0] // "cpu  user nice system idle ..."
    const parts = line.replace(/^cpu\s+/, '').split(/\s+/).map(Number)
    const idle = parts[3] + (parts[4] ?? 0) // idle + iowait
    const total = parts.reduce((a, b) => a + b, 0)
    return { idle, total }
  } catch {
    return { idle: 0, total: 0 }
  }
}

async function readCpuTemp() {
  try {
    const thermalBase = '/sys/class/thermal'
    const zones = await readdir(thermalBase).catch(() => [])
    const temps = await Promise.all(
      zones
        .filter(z => z.startsWith('thermal_zone'))
        .map(async z => {
          const raw = await readFile(join(thermalBase, z, 'temp'), 'utf8').catch(() => '0')
          return parseInt(raw, 10) / 1000 // millidegrees → degrees
        })
    )
    return temps.length > 0 ? Math.max(...temps) : 0
  } catch {
    return 0
  }
}

async function updateSnapshot() {
  // CPU percent — delta between two snapshots
  const { idle, total } = await readCpuTimes()
  if (prevTotal > 0) {
    const dIdle = idle - prevIdle
    const dTotal = total - prevTotal
    cpuPercent = dTotal > 0 ? Math.round(((dTotal - dIdle) / dTotal) * 100) : 0
  }
  prevIdle = idle
  prevTotal = total

  // Temperature
  cpuTemp = await readCpuTemp()
}

/** Returns the latest cached vitals snapshot. */
export function getVitals() {
  return { cpu_percent: cpuPercent, cpu_temp: cpuTemp }
}

/** Start the background update interval. Call once on server boot. */
export function startVitalsWorker(intervalMs = 10_000) {
  // Immediately take first snapshot (so second call 10s later has a delta)
  updateSnapshot()
  return setInterval(updateSnapshot, intervalMs)
}
