import type { Task, TaskEvent, TaskDecision, TaskContract, TransitionError, PipelineState, GlobalStatus, TaskListItem } from './types';

const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw data;
  return data as T;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`);
  return res.json();
}

// ─── GlobalStatus ─────────────────────────────────────────────────────────────

export function getStatus(): Promise<GlobalStatus> {
  return fetchJson<GlobalStatus>('/status');
}

// ─── Response shapes from the backend ──────────────────────────────────────

interface TaskListResponse {
  task_id: string;
  contract: TaskContract;
  status: {
    state: string;
    current_owner: string;
    current_route?: string;
    blockers?: string[];
    retries?: number;
    updated_at?: string;
    last_material_update?: string;
    [key: string]: unknown;
  };
}

interface TaskDetailResponse extends TaskListResponse {
  events: TaskEvent[];
  decisions: TaskDecision[];
}

// ─── Transform helpers ────────────────────────────────────────────────────────

const TERMINAL = ['DONE', 'FAILED', 'CANCELLED', 'SUPERSEDED'];

function minutesAgo(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function toTask(item: TaskListResponse): Task {
  const s = item.status;
  const c = item.contract;
  return {
    id: item.task_id,
    state: (s.state || 'INTAKE') as PipelineState,
    owner: s.current_owner || '',
    route: c?.route || s.current_route || '?',
    title: (c?.title || '').slice(0, 80),
    age: minutesAgo(s.updated_at || s.last_material_update),
    ttl: null,
    blockers: (s.blockers || []).length,
    retries: s.retries || 0,
    terminal: TERMINAL.includes(s.state),
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    state_entered_at: s.updated_at || s.last_material_update || undefined,
    contract: c,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchTasks(): Promise<Task[]> {
  const items = await request<TaskListResponse[]>('/tasks');
  return items.map(toTask);
}

/** getTasks — alias returning raw TaskListItem shape (used by Layout Shell) */
export function getTasks(): Promise<TaskListItem[]> {
  return fetchJson<TaskListItem[]>('/tasks');
}

export async function fetchTask(id: string): Promise<Task> {
  const item = await request<TaskDetailResponse>(`/tasks/${id}`);
  const task = toTask(item);
  task.events = item.events;
  task.decisions = item.decisions;
  return task;
}

export async function fetchTaskEvents(taskId: string): Promise<TaskEvent[]> {
  return request<TaskEvent[]>(`/tasks/${taskId}/events`);
}

export async function fetchTaskDecisions(taskId: string): Promise<TaskDecision[]> {
  return request<TaskDecision[]>(`/tasks/${taskId}/decisions`);
}

export async function fetchTaskContract(taskId: string): Promise<TaskContract> {
  return request<TaskContract>(`/tasks/${taskId}/contract`);
}

export async function transitionTask(
  id: string,
  state: PipelineState
): Promise<{ ok: true } | TransitionError> {
  try {
    return await request(`/tasks/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    });
  } catch (e: unknown) {
    const err = e as Record<string, string>;
    if (err?.error === 'GUARD_VIOLATION') {
      return {
        error: 'GUARD_VIOLATION',
        message: err.detail || err.message || 'Guard violation',
        task_id: id,
        requested_state: state,
      };
    }
    throw e;
  }
}

export function addTaskEvent(
  id: string,
  eventType: string,
  data?: Record<string, unknown>
): Promise<{ ok: true }> {
  return request(`/tasks/${id}/event`, {
    method: 'POST',
    body: JSON.stringify({ type: eventType, payload: data }),
  });
}

export function createTask(data: {
  title: string;
  route: string;
  outcome_type: string;
}): Promise<{ task_id: string }> {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export interface AgentInfo {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: 'active' | 'idle' | 'dead' | 'waiting' | 'unknown';
  current_task_id: string | null;
  current_step: string | null;
  progress_note: string | null;
  checkpoint_safe: boolean | null;
  last_seen: string | null;
  session_key: string | null;
  workspace_path: string | null;
  topic_id: number | null;
  heartbeat_raw: Record<string, unknown> | null;
  mailbox: { inbox: number; processing: number; done: number; deadletter: number };
}

export interface Envelope {
  id: string; from: string; type: string; subject: string; priority: string;
  created_at: string; expires_at: string | null; payload?: unknown;
}

export interface AgentEvent {
  event_id?: string; event_type?: string; task_id?: string;
  actor?: string; timestamp?: string; [key: string]: unknown;
}

export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${BASE}/agents`);
  if (!res.ok) throw new Error(`Failed to fetch agents: ${res.status}`);
  return res.json();
}
export async function fetchAgentMailbox(agentId: string, folder: string): Promise<Envelope[]> {
  const res = await fetch(`${BASE}/agents/${agentId}/mailbox/${folder}`);
  if (!res.ok) throw new Error(`Failed to fetch mailbox: ${res.status}`);
  return res.json();
}
export async function fetchAgentInboxMd(agentId: string): Promise<string> {
  const res = await fetch(`${BASE}/agents/${agentId}/inbox-md`);
  if (!res.ok) throw new Error(`Failed to fetch inbox md: ${res.status}`);
  return (await res.json()).content;
}
export async function fetchAgentLog(agentId: string): Promise<string> {
  const res = await fetch(`${BASE}/agents/${agentId}/log`);
  if (!res.ok) throw new Error(`Failed to fetch log: ${res.status}`);
  return (await res.json()).content;
}
export async function fetchAgentEvents(agentId: string): Promise<AgentEvent[]> {
  const res = await fetch(`${BASE}/events?agent=${agentId}`);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  return res.json();
}
export async function sendAgentMessage(agentId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/message`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.json();
}
export async function wakeAgent(agentId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/wake`, { method: 'POST' });
  return res.json();
}
export async function deleteEnvelope(agentId: string, folder: string, envelopeId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/mailbox/${folder}/${envelopeId}`, { method: 'DELETE' });
  return res.json();
}
export async function moveEnvelope(agentId: string, fromFolder: string, toFolder: string, envelopeId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/mailbox/${fromFolder}/${envelopeId}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: toFolder }),
  });
  return res.json();
}

// ─── Logs ────────────────────────────────────────────────────────────────────

export interface GatewayLogResponse {
  lines: string[]; file_size_bytes: number; file_date: string; error?: string;
}
export interface WorkerFile { name: string; size_bytes: number }
export interface WorkerListResponse { files: WorkerFile[] }
export interface WorkerLogResponse { lines: string[]; file_size_bytes: number; file_name: string }
export interface Decision {
  agent?: string; task_id?: string; gate_type?: string; result?: string;
  timestamp?: string; ts?: string; _task_dir?: string; [key: string]: unknown;
}
export interface LogEvent {
  type?: string; actor?: string; agent?: string; task_id?: string;
  timestamp?: string; ts?: string; data?: Record<string, unknown>;
  _task_dir?: string; [key: string]: unknown;
}

export function getGatewayLog(lines = 200): Promise<GatewayLogResponse> {
  return fetchJson<GatewayLogResponse>(`/api/logs/gateway?lines=${lines}`)
}
export function getWorkerList(): Promise<WorkerListResponse> {
  return fetchJson<WorkerListResponse>('/api/logs/worker')
}
export function getWorkerLog(name: string, lines = 100): Promise<WorkerLogResponse> {
  return fetchJson<WorkerLogResponse>(`/api/logs/worker/${encodeURIComponent(name)}?lines=${lines}`)
}
export function getDecisions(params?: { agent?: string; task_id?: string }): Promise<Decision[]> {
  const sp = new URLSearchParams()
  if (params?.agent) sp.set('agent', params.agent)
  if (params?.task_id) sp.set('task_id', params.task_id)
  const qs = sp.toString()
  return fetchJson<Decision[]>(`/api/decisions${qs ? `?${qs}` : ''}`)
}
export function getLogEvents(params?: { agent?: string; task_id?: string; type?: string }): Promise<LogEvent[]> {
  const sp = new URLSearchParams()
  if (params?.agent) sp.set('agent', params.agent)
  if (params?.task_id) sp.set('task_id', params.task_id)
  if (params?.type) sp.set('type', params.type)
  const qs = sp.toString()
  return fetchJson<LogEvent[]>(`/api/events${qs ? `?${qs}` : ''}`)
}

// Aliases for backwards-compat with Logs components
export { getLogEvents as getEvents }
export type { LogEvent as Event }
