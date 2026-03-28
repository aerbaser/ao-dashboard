import type {
  Task,
  TaskEvent,
  TaskDecision,
  TaskContract,
  TransitionError,
  PipelineState,
  GlobalStatus,
  TaskListItem,
  ServiceInfo,
  CronEntry,
  CronResponse,
  VitalsResponse,
  RateLimitsResponse,
} from './types';

const BASE = '/api';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`API ${path}: expected JSON but got HTML/text (status ${res.status})`);
  }
  if (!res.ok) throw data;
  return data;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    // Try to parse error body, fallback to status code
    const body = await res.text().catch(() => '');
    throw new Error(`API ${path}: ${res.status}${body.startsWith('{') ? ' — ' + body.slice(0, 100) : ''}`);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`API ${path}: expected JSON but got non-JSON response`);
  }
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
  actors?: string[];
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
    actors: item.actors || [],
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
  model: string | null;
  skills: string[];
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
export async function fetchAgentFile(agentId: string, filename: string): Promise<{ content: string; filename: string; path: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/files/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  return res.json();
}
export async function saveAgentFile(agentId: string, filename: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/files/${encodeURIComponent(filename)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
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
export async function changeAgentModel(
  agentId: string,
  model: string
): Promise<{ ok: boolean; restarting?: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  return res.json()
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export async function fetchAgentSkills(agentId: string): Promise<{ skills: string[] }> {
  return fetchJson<{ skills: string[] }>(`/agents/${agentId}/skills`);
}

export async function updateAgentSkills(agentId: string, skills: string[]): Promise<{ ok: boolean; skills: string[]; error?: string }> {
  return request<{ ok: boolean; skills: string[]; error?: string }>(`/agents/${agentId}/skills`, {
    method: 'PUT',
    body: JSON.stringify({ skills }),
  });
}

export interface SkillInfo {
  name: string;
  description: string;
}

export type SkillsData = Record<string, SkillInfo[]>;

export async function fetchAllSkills(): Promise<SkillsData> {
  return fetchJson<SkillsData>('/skills');
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
  return fetchJson<GatewayLogResponse>(`/logs/gateway?lines=${lines}`)
}
export function getWorkerList(): Promise<WorkerListResponse> {
  return fetchJson<WorkerListResponse>('/logs/worker')
}
export function getWorkerLog(name: string, lines = 100): Promise<WorkerLogResponse> {
  return fetchJson<WorkerLogResponse>(`/logs/worker/${encodeURIComponent(name)}?lines=${lines}`)
}
export function getDecisions(params?: { agent?: string; task_id?: string }): Promise<Decision[]> {
  const sp = new URLSearchParams()
  if (params?.agent) sp.set('agent', params.agent)
  if (params?.task_id) sp.set('task_id', params.task_id)
  const qs = sp.toString()
  return fetchJson<Decision[]>(`/decisions${qs ? `?${qs}` : ''}`)
}
export function getLogEvents(params?: { agent?: string; task_id?: string; type?: string }): Promise<LogEvent[]> {
  const sp = new URLSearchParams()
  if (params?.agent) sp.set('agent', params.agent)
  if (params?.task_id) sp.set('task_id', params.task_id)
  if (params?.type) sp.set('type', params.type)
  const qs = sp.toString()
  return fetchJson<LogEvent[]>(`/events${qs ? `?${qs}` : ''}`)
}

// Aliases for backwards-compat with Logs components
export { getLogEvents as getEvents }
export type { LogEvent as Event }

// ─── System ─────────────────────────────────────────────────────────────────

export function getServices(): Promise<ServiceInfo[]> {
  return fetchJson<ServiceInfo[]>('/services')
}

export function runServiceAction(name: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/services/${encodeURIComponent(name)}/${action}`, {
    method: 'POST',
  })
}

export function getCron(): Promise<CronResponse> {
  return fetchJson<CronResponse>('/cron')
}

export function updateCron(entries: CronEntry[]): Promise<CronResponse> {
  return request<CronResponse>('/cron', {
    method: 'POST',
    body: JSON.stringify({ entries }),
  })
}

export function getVitalsDetail(): Promise<VitalsResponse> {
  return fetchJson<VitalsResponse>('/vitals')
}

export function getRateLimits(): Promise<RateLimitsResponse> {
  return fetchJson<RateLimitsResponse>('/rate-limits')
}

export function switchRateLimitProfile(profile: string): Promise<{ ok: boolean; active: string }> {
  return request<{ ok: boolean; active: string }>('/rate-limits/switch', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  })
}

// ─── Ideas ──────────────────────────────────────────────────────────────────

// Re-export Idea from types.ts for backwards compatibility
export type { Idea } from './types'
import type { Idea } from './types'

export function fetchIdeas(): Promise<Idea[]> {
  return fetchJson<Idea[]>('/ideas')
}

export function fetchIdea(id: string): Promise<Idea> {
  return fetchJson<Idea>(`/ideas/${id}`)
}

export function createIdea(data: {
  title: string
  body: string
  target_agent?: string
  target_project?: string
  tags?: string[]
}): Promise<Idea> {
  return request<Idea>('/ideas', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateIdea(
  id: string,
  data: Partial<Pick<Idea, 'title' | 'body' | 'tags' | 'status' | 'artifact_md'>>
): Promise<Idea> {
  return request<Idea>(`/ideas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export function approveIdea(id: string): Promise<{ ok: true; task_id: string }> {
  return request<{ ok: true; task_id: string }>(`/ideas/${id}/approve`, {
    method: 'POST',
  })
}

export function brainstormIdea(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/ideas/${id}/brainstorm`, {
    method: 'POST',
  })
}

export function archiveIdea(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/ideas/${id}/archive`, {
    method: 'POST',
  })
}
