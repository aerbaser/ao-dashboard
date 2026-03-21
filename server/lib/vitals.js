import { execFile } from 'child_process'
import { readFile, readdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

let cachedSummary = { cpu_percent: 0, cpu_temp: 0 }

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function readProcStat() {
  const raw = await readFile('/proc/stat', 'utf8')
  return raw
    .split('\n')
    .filter((line) => /^cpu\d*\s+/.test(line))
    .map((line) => {
      const [label, ...values] = line.trim().split(/\s+/)
      const nums = values.map(Number)
      const idle = nums[3] + (nums[4] ?? 0)
      const total = nums.reduce((sum, value) => sum + value, 0)
      return { label, idle, total }
    })
}

async function sampleCpuUsage(delayMs = 200) {
  const first = await readProcStat()
  await sleep(delayMs)
  const second = await readProcStat()
  const byLabel = new Map(first.map((entry) => [entry.label, entry]))
  const usage = second.map((entry) => {
    const previous = byLabel.get(entry.label)
    if (!previous) return { label: entry.label, usage: 0 }
    const totalDelta = entry.total - previous.total
    const idleDelta = entry.idle - previous.idle
    const percent = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : 0
    return { label: entry.label, usage: clampPercent(percent) }
  })

  const total = usage.find((entry) => entry.label === 'cpu')?.usage ?? 0
  const perCore = usage
    .filter((entry) => entry.label !== 'cpu')
    .slice(0, 16)
    .map((entry) => entry.usage)

  while (perCore.length < 16) {
    perCore.push(0)
  }

  return { overall: total, per_core: perCore }
}

async function readCpuTemperature() {
  try {
    const thermalBase = '/sys/class/thermal'
    const zones = await readdir(thermalBase)
    const temps = await Promise.all(
      zones
        .filter((zone) => zone.startsWith('thermal_zone'))
        .map(async (zone) => {
          const raw = await readFile(join(thermalBase, zone, 'temp'), 'utf8').catch(() => '0')
          const value = Number.parseInt(raw, 10)
          return value > 1000 ? value / 1000 : value
        }),
    )

    const valid = temps.filter((value) => Number.isFinite(value) && value > 0)
    return valid.length ? Math.round(Math.max(...valid)) : 0
  } catch {
    return 0
  }
}

async function readMemory() {
  try {
    const raw = await readFile('/proc/meminfo', 'utf8')
    const values = new Map(
      raw.split('\n')
        .map((line) => line.match(/^([^:]+):\s+(\d+)/))
        .filter(Boolean)
        .map((match) => [match[1], Number(match[2])]),
    )

    const totalKb = values.get('MemTotal') ?? 0
    const availableKb = values.get('MemAvailable') ?? 0
    const usedMb = Math.round((totalKb - availableKb) / 1024)
    const totalMb = Math.round(totalKb / 1024)

    const { stdout } = await execFileAsync('ps', [
      '-eo',
      'pid=,comm=,%cpu=,%mem=,rss=',
      '--sort=-rss',
    ], { timeout: 3000 })
    const top_processes = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(0, 5)
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(.+?)\s+([\d.]+)\s+([\d.]+)\s+(\d+)$/)
        if (!match) return null
        return {
          pid: Number(match[1]),
          name: match[2],
          cpu_percent: Number(match[3]),
          memory_percent: Number(match[4]),
          memory_mb: Math.round(Number(match[5]) / 1024),
        }
      })
      .filter(Boolean)

    return { used_mb: usedMb, total_mb: totalMb, top_processes }
  } catch {
    return { used_mb: 0, total_mb: 0, top_processes: [] }
  }
}

async function readDisk() {
  try {
    const { stdout } = await execFileAsync('df', ['-BM', '/'], { timeout: 3000 })
    const lines = stdout.trim().split('\n')
    const stats = lines[lines.length - 1].split(/\s+/)
    const total_mb = Number.parseInt(stats[1], 10) || 0
    const used_mb = Number.parseInt(stats[2], 10) || 0

    const keyPaths = [
      join(homedir(), 'clawd/tasks'),
      join(homedir(), 'clawd/runtime'),
      join(homedir(), 'clawd/memory'),
      '/tmp/openclaw',
    ]
    const { stdout: duOut } = await execFileAsync('du', ['-sm', ...keyPaths], { timeout: 4000 })
    const key_dirs = duOut
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [size, dir] = line.split(/\s+/, 2)
        return { path: dir, size_mb: Number.parseInt(size, 10) || 0 }
      })

    return { used_mb, total_mb, key_dirs }
  } catch {
    return { used_mb: 0, total_mb: 0, key_dirs: [] }
  }
}

async function readLoadAverage() {
  try {
    const raw = await readFile('/proc/loadavg', 'utf8')
    const [one, five, fifteen] = raw.trim().split(/\s+/)
    return {
      one: Number(one) || 0,
      five: Number(five) || 0,
      fifteen: Number(fifteen) || 0,
    }
  } catch {
    return { one: 0, five: 0, fifteen: 0 }
  }
}

async function readUptimeSeconds() {
  try {
    const raw = await readFile('/proc/uptime', 'utf8')
    return Math.floor(Number(raw.split(/\s+/)[0]) || 0)
  } catch {
    return 0
  }
}

async function readTailscaleIp() {
  try {
    const { stdout } = await execFileAsync('tailscale', ['ip', '-4'], { timeout: 2000 })
    return stdout.trim().split('\n').find(Boolean) ?? null
  } catch {
    return null
  }
}

export async function collectVitals() {
  const [cpu, temperature, memory, disk, load, uptime_seconds, tailscale_ip] = await Promise.all([
    sampleCpuUsage(),
    readCpuTemperature(),
    readMemory(),
    readDisk(),
    readLoadAverage(),
    readUptimeSeconds(),
    readTailscaleIp(),
  ])

  return {
    cpu: {
      overall: cpu.overall,
      temperature,
      per_core: cpu.per_core,
    },
    memory,
    disk,
    load,
    tailscale_ip,
    uptime_seconds,
  }
}

async function updateSnapshot() {
  try {
    const vitals = await collectVitals()
    cachedSummary = {
      cpu_percent: vitals.cpu.overall,
      cpu_temp: vitals.cpu.temperature,
    }
  } catch {
    // Keep last successful snapshot
  }
}

export function getVitals() {
  return cachedSummary
}

export function startVitalsWorker(intervalMs = 10_000) {
  updateSnapshot()
  return setInterval(updateSnapshot, intervalMs)
}
