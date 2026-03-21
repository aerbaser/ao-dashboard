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
