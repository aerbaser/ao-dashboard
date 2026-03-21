export interface GatewayLogResponse {
  lines: string[]
  file_size_bytes: number
  file_date: string
  error?: string
}

export interface WorkerFile {
  name: string
  size_bytes: number
}

export interface WorkerListResponse {
  files: WorkerFile[]
}

export interface WorkerLogResponse {
  lines: string[]
  file_size_bytes: number
  file_name: string
}

export interface Decision {
  agent: string
  task_id: string
  gate_type: string
  result: string
  timestamp: string
  ts?: string
  _task_dir: string
  [key: string]: unknown
}

export interface Event {
  type: string
  actor: string
  agent?: string
  task_id: string
  timestamp: string
  ts?: string
  data?: Record<string, unknown>
  _task_dir: string
  [key: string]: unknown
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}

export function getGatewayLog(lines = 200): Promise<GatewayLogResponse> {
  return fetchJson(`/api/logs/gateway?lines=${lines}`)
}

export function getWorkerList(): Promise<WorkerListResponse> {
  return fetchJson('/api/logs/worker')
}

export function getWorkerLog(name: string, lines = 100): Promise<WorkerLogResponse> {
  return fetchJson(`/api/logs/worker/${encodeURIComponent(name)}?lines=${lines}`)
}

export function getDecisions(params?: {
  agent?: string
  task_id?: string
  from?: string
  to?: string
}): Promise<Decision[]> {
  const sp = new URLSearchParams()
  if (params?.agent) sp.set('agent', params.agent)
  if (params?.task_id) sp.set('task_id', params.task_id)
  if (params?.from) sp.set('from', params.from)
  if (params?.to) sp.set('to', params.to)
  const qs = sp.toString()
  return fetchJson(`/api/decisions${qs ? `?${qs}` : ''}`)
}

export function getEvents(params?: { agent?: string; task_id?: string; type?: string }): Promise<Event[]> {
  const sp = new URLSearchParams()
  if (params?.agent) sp.set('agent', params.agent)
  if (params?.task_id) sp.set('task_id', params.task_id)
  if (params?.type) sp.set('type', params.type)
  const qs = sp.toString()
  return fetchJson(`/api/events${qs ? `?${qs}` : ''}`)
}
