import { readFile, readdir } from 'fs/promises'
import { join } from 'path'

function parseCpuTimes(raw) {
  const [line = ''] = raw.split('\n')
  const values = line
    .replace(/^cpu\s+/, '')
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))

  const idle = (values[3] ?? 0) + (values[4] ?? 0)
  const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)

  return { idle, total }
}

export function calculateCpuPercent(previous, current) {
  const idleDelta = current.idle - previous.idle
  const totalDelta = current.total - previous.total

  if (totalDelta <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(((totalDelta - idleDelta) / totalDelta) * 100)))
}

async function readCpuTimes() {
  try {
    const raw = await readFile('/proc/stat', 'utf8')
    return parseCpuTimes(raw)
  } catch {
    return { idle: 0, total: 0 }
  }
}

async function readCpuTemp() {
  try {
    const zones = await readdir('/sys/class/thermal')
    const temps = await Promise.all(
      zones
        .filter((zone) => zone.startsWith('thermal_zone'))
        .map(async (zone) => {
          try {
            const raw = await readFile(join('/sys/class/thermal', zone, 'temp'), 'utf8')
            return Math.round(parseInt(raw, 10) / 1_000)
          } catch {
            return 0
          }
        }),
    )

    return temps.reduce((maxTemp, value) => Math.max(maxTemp, value), 0)
  } catch {
    return 0
  }
}

export function createVitalsMonitor({
  intervalMs = 10_000,
  readCpuTimesImpl = readCpuTimes,
  readCpuTempImpl = readCpuTemp,
} = {}) {
  let snapshot = { cpu_percent: 0, cpu_temp: 0 }
  let previous = null
  let timer = null

  async function update() {
    const [current, cpuTemp] = await Promise.all([
      readCpuTimesImpl(),
      readCpuTempImpl(),
    ])

    if (previous) {
      snapshot = {
        cpu_percent: calculateCpuPercent(previous, current),
        cpu_temp: Number.isFinite(cpuTemp) ? cpuTemp : 0,
      }
    } else {
      snapshot = {
        cpu_percent: snapshot.cpu_percent,
        cpu_temp: Number.isFinite(cpuTemp) ? cpuTemp : 0,
      }
    }

    previous = current
    return snapshot
  }

  return {
    getSnapshot() {
      return { ...snapshot }
    },

    async update() {
      return update()
    },

    start() {
      if (timer) {
        return timer
      }

      void update()
      timer = setInterval(() => {
        void update()
      }, intervalMs)
      timer.unref?.()
      return timer
    },

    stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
    },
  }
}
