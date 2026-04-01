import { Router } from 'express'
import { execFile } from 'child_process'
import { appendFile, readFile, mkdir } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const FORBIDDEN_FILE = join(homedir(), 'clawd/memory/forbidden-services.json')
const AUDIT_LOG = join(homedir(), 'clawd/runtime/dashboard-audit.log')
const COMPAT_FORBIDDEN = ['openclaw-gateway']
const VALID_ACTIONS = new Set(['start', 'stop', 'restart'])

export const SERVICE_META = {
  'openclaw-gateway': { display_name: 'OpenClaw Gateway', group: 'Core', port: 18789 },
  'webhook-receiver': { display_name: 'Webhook Receiver', group: 'Core', port: 9055 },
  'dashboard-server': { display_name: 'Dashboard Server', group: 'Core', port: 3333 },
  'ao@sokrat-core': { display_name: 'AO Sokrat Core', group: 'Agents', port: null },
  'ao-dashboard': { display_name: 'AO Dashboard', group: 'Agents', port: 3000 },
  'brainstorm-watcher': { display_name: 'Brainstorm Watcher', group: 'Agents', port: null },
  'dual-brainstorm-bridge': { display_name: 'Dual Brainstorm Bridge', group: 'Agents', port: null },
  'profiles-bot': { display_name: 'Profiles Bot', group: 'Agents', port: null },
  'codex-proxy': { display_name: 'Codex Proxy', group: 'Integrations', port: null },
  'credential-share': { display_name: 'Credential Share', group: 'Integrations', port: 8224 },
  'vaultwarden-tunnel': { display_name: 'Vaultwarden Tunnel', group: 'Integrations', port: null },
  'ao-funnel': { display_name: 'AO Funnel', group: 'Integrations', port: null },
  'ao-dashboard-tunnel': { display_name: 'AO Dashboard Tunnel', group: 'Integrations', port: null },
  'gpt-researcher': { display_name: 'GPT Researcher', group: 'Integrations', port: null },
  'vw-ops-crm': { display_name: 'VW Ops CRM', group: 'Integrations', port: 3001 },
}

function normalizeServiceName(name) {
  return name.endsWith('.service') ? name.slice(0, -8) : name
}

function unitName(name) {
  return name.endsWith('.service') ? name : `${name}.service`
}

function parseSystemctlShow(stdout) {
  const data = {}
  for (const line of stdout.split('\n')) {
    const idx = line.indexOf('=')
    if (idx === -1) continue
    data[line.slice(0, idx)] = line.slice(idx + 1)
  }
  return data
}

function parseSystemdTimestamp(raw) {
  // systemd outputs: "Thu 2026-03-26 17:26:28 WET" or "Thu 2026-03-26 17:26:28 UTC"
  // Date.parse can't handle this. Strip day-name prefix and timezone suffix,
  // parse as local if timezone is WET/WEST/CET/CEST, else as-is.
  if (!raw || raw === 'n/a' || raw === '') return NaN
  // Remove leading day name (e.g. "Thu ")
  const cleaned = raw.replace(/^[A-Za-z]{3}\s+/, '')
  // Try ISO-like: "2026-03-26 17:26:28 WET" → "2026-03-26T17:26:28"
  const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/)
  if (match) {
    const iso = `${match[1]}T${match[2]}`
    const ts = Date.parse(iso) // parsed as local time
    if (!Number.isNaN(ts)) return ts
  }
  // Fallback: try raw parse
  return Date.parse(raw)
}

function formatDuration(from) {
  const started = typeof from === 'number' ? from : parseSystemdTimestamp(from)
  if (Number.isNaN(started)) return 'Unknown'
  const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function formatMemory(bytes) {
  if (!bytes || Number.isNaN(bytes)) return 0
  return Math.max(0, Math.round(bytes / (1024 * 1024)))
}

export function isForbiddenService(name, forbiddenNames) {
  const allPatterns = [...new Set([...COMPAT_FORBIDDEN, ...forbiddenNames])]
  return allPatterns.some((pattern) => {
    if (pattern.includes('*')) {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
      return new RegExp(`^${escaped}$`).test(name)
    }
    return normalizeServiceName(pattern) === normalizeServiceName(name)
  })
}

export async function readForbiddenNames() {
  try {
    const raw = await readFile(FORBIDDEN_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    const names = Array.isArray(parsed.forbidden)
      ? parsed.forbidden.map((entry) => entry?.name).filter(Boolean)
      : []
    return [...new Set([...names, ...COMPAT_FORBIDDEN])]
  } catch {
    return [...COMPAT_FORBIDDEN]
  }
}

async function execFileAsync(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

async function querySystemctl(scope, name) {
  const args = scope === 'user'
    ? ['--user', 'show', unitName(name)]
    : ['show', unitName(name)]
  args.push(
    '--property=Id',
    '--property=ActiveState',
    '--property=SubState',
    '--property=MemoryCurrent',
    '--property=ActiveEnterTimestamp',
  )
  const { stdout } = await execFileAsync('systemctl', args, { timeout: 2500 })
  return parseSystemctlShow(stdout)
}

async function readServiceStatus(name) {
  const meta = SERVICE_META[name]
  if (!meta) return null

  try {
    // Try user scope first, fall back to system scope if inactive
    let info = await querySystemctl('user', name).catch(() => null)
    if (!info || info.ActiveState !== 'active') {
      const systemInfo = await querySystemctl('system', name).catch(() => null)
      if (systemInfo?.ActiveState === 'active') info = systemInfo
    }
    if (!info) info = { ActiveState: 'inactive', SubState: 'unknown' }

    return {
      name,
      display_name: meta.display_name,
      group: meta.group,
      port: meta.port,
      status: info.ActiveState || 'inactive',
      sub_status: info.SubState || 'unknown',
      uptime: info.ActiveState === 'active' ? formatDuration(info.ActiveEnterTimestamp) : null,
      memory_mb: info.ActiveState === 'active' ? formatMemory(Number(info.MemoryCurrent || '0')) : null,
    }
  } catch {
    return {
      name,
      display_name: meta.display_name,
      group: meta.group,
      port: meta.port,
      status: 'inactive',
      sub_status: 'unknown',
      uptime: null,
      memory_mb: null,
    }
  }
}

export async function getServicesSnapshot() {
  const forbiddenNames = await readForbiddenNames()
  const services = await Promise.all(
    Object.keys(SERVICE_META).map(async (name) => {
      const service = await readServiceStatus(name)
      return service ? {
        ...service,
        forbidden: isForbiddenService(name, forbiddenNames),
      } : null
    }),
  )

  return services.filter(Boolean)
}

export async function runSystemctlAction(name, action) {
  await execFileAsync('systemctl', ['--user', action, unitName(name)], { timeout: 5000 })
}

export async function appendAuditLog(entry) {
  await mkdir(join(homedir(), 'clawd/runtime'), { recursive: true })
  await appendFile(AUDIT_LOG, `${entry}\n`, 'utf8')
}

export function createServicesRouter(deps = {}) {
  const router = Router()
  const readForbidden = deps.readForbiddenNames ?? readForbiddenNames
  const readSnapshot = deps.getServicesSnapshot ?? getServicesSnapshot
  const systemctlAction = deps.runSystemctlAction ?? runSystemctlAction
  const audit = deps.appendAuditLog ?? appendAuditLog

  router.get('/', async (_req, res) => {
    try {
      const services = await readSnapshot()
      res.json(services)
    } catch (error) {
      res.status(500).json({ error: 'Failed to load services', detail: String(error) })
    }
  })

  router.post('/:name/:action', async (req, res) => {
    const name = normalizeServiceName(req.params.name)
    const action = req.params.action

    if (!SERVICE_META[name]) {
      res.status(404).json({ error: `Unknown service: ${name}` })
      return
    }

    if (!VALID_ACTIONS.has(action)) {
      res.status(400).json({ error: 'Unsupported action' })
      return
    }

    try {
      const forbiddenNames = await readForbidden()
      if (isForbiddenService(name, forbiddenNames)) {
        res.status(403).json({ error: `Service ${name} is forbidden` })
        return
      }

      await systemctlAction(name, action)
      await audit(`${new Date().toISOString()} ${action} ${name}`)
      res.json({ ok: true, name, action })
    } catch (error) {
      res.status(500).json({ error: 'Service action failed', detail: String(error) })
    }
  })

  return router
}

const router = createServicesRouter()

export default router
