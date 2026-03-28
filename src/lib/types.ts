// GlobalStatus — live system status from GET /api/status
export interface GlobalStatus {
  gateway_up: boolean
  agents_alive: number
  agents_total: number
  active_tasks: number
  blocked_tasks: number
  stuck_tasks: number
  failed_services: number
  cpu_percent: number | null
  cpu_temp: number | null
  claude_usage_percent: number | null
  codex_usage_percent: number | null
  awaiting_owner_count: number
  awaiting_owner_overdue: boolean
  timestamp: string
}

export const PIPELINE_STATES = [
  'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING', 'SETUP',
  'EXECUTION', 'AWAITING_OWNER', 'REVIEW_PENDING', 'CI_PENDING', 'QUALITY_GATE',
  'FINALIZING', 'DEPLOYING', 'OBSERVING', 'DONE',
  'BLOCKED', 'FAILED', 'WAITING_USER', 'STUCK',
] as const;

export type PipelineState = (typeof PIPELINE_STATES)[number];

export const MAIN_FLOW_STATES: PipelineState[] = [
  'INTAKE', 'CONTEXT', 'RESEARCH', 'DESIGN', 'PLANNING', 'SETUP',
  'EXECUTION', 'AWAITING_OWNER', 'REVIEW_PENDING', 'CI_PENDING', 'QUALITY_GATE',
  'FINALIZING', 'DEPLOYING', 'OBSERVING', 'DONE',
];

export const SIDE_STATES: PipelineState[] = [
  'BLOCKED', 'FAILED', 'WAITING_USER', 'STUCK',
];

export const ERROR_STATES: PipelineState[] = ['BLOCKED', 'FAILED', 'STUCK'];
export const TERMINAL_STATES: PipelineState[] = ['DONE', 'FAILED'];
export const ACTIVE_STATES: PipelineState[] = MAIN_FLOW_STATES.filter(
  (s) => s !== 'DONE'
);

export const VALID_ROUTES = [
  'artifact_route', 'build_route', 'diagnostic_route', 'publish_route',
  'ops_route', 'incident_route', 'hybrid_route',
] as const;

export type Route = (typeof VALID_ROUTES)[number];

export const VALID_OUTCOME_TYPES = [
  'strategy_doc', 'design_pack', 'website_release', 'app_release',
  'bugfix_release', 'audit_pack', 'publish_asset', 'ops_change',
  'incident_recovery',
] as const;

export type OutcomeType = (typeof VALID_OUTCOME_TYPES)[number];

export interface TaskEvent {
  event_id: string;
  event_type: string;
  task_id: string;
  actor: string;
  timestamp: string;
  from_state?: string | null;
  to_state?: string;
  reason?: string;
  [key: string]: unknown;
}

/** Parsed comment for display in CommentThread */
export interface CommentEvent {
  actor: string;
  body: string;
  timestamp: string;
}

export interface TaskDecision {
  decision_id: string;
  task_id: string;
  gate_type: string;
  resolved_by: string;
  resolved_at: string;
  resolution_mode: string;
  summary: string;
}

export interface TaskContract {
  schema_version: string;
  task_id: string;
  title: string;
  raw_request: string;
  outcome_type: string;
  delivery_mode: string;
  route: string;
  full_solution: boolean;
  approval_policy: string;
  constraints: string[];
  created_at: string;
}

export interface Task {
  id: string;
  state: PipelineState;
  owner: string;
  route: string;
  title: string;
  age: number | null;
  ttl: string | null;
  blockers: number;
  retries: number;
  terminal: boolean;
  hasQuality: boolean;
  hasOutcome: boolean;
  hasRelease: boolean;
  state_entered_at?: string;
  actors?: string[];
  contract?: TaskContract;
  events?: TaskEvent[];
  decisions?: TaskDecision[];
}

export interface TransitionError {
  error: string;
  message: string;
  task_id: string;
  requested_state: string;
}

export type StateGroup = 'active' | 'terminal' | 'error' | 'all';

// TaskListItem — shape returned by GET /api/tasks and GET /api/tasks/:id
export interface TaskListItem {
  id: string;
  state: PipelineState;
  owner: string;
  route: string;
  title: string;
  age: number | null;
  ttl: string | null;
  blockers: number;
  retries: number;
  terminal: boolean;
  hasQuality: boolean;
  hasOutcome: boolean;
  hasRelease: boolean;
  state_entered_at?: string;
  actors?: string[];
}

export type ServiceGroup = 'Core' | 'Agents' | 'Integrations';
export type ServiceStatus = 'active' | 'inactive' | 'failed' | 'activating' | 'deactivating';

export interface ServiceInfo {
  name: string;
  display_name: string;
  group: ServiceGroup;
  status: ServiceStatus | string;
  sub_status?: string;
  uptime: string;
  memory_mb: number;
  port?: number | null;
  forbidden: boolean;
}

export interface CronEntry {
  id: string;
  schedule: string;
  command: string;
  enabled: boolean;
  label: string;
  group: 'AO Pipeline' | 'Maintenance' | 'Sync' | 'Other' | string;
}

export interface CronResponse {
  entries: CronEntry[];
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  memory_mb: number;
}

export interface DiskDirectoryUsage {
  path: string;
  size_mb: number;
}

export interface VitalsResponse {
  cpu: {
    overall: number;
    temperature: number;
    per_core: number[];
  };
  memory: {
    used_mb: number;
    total_mb: number;
    top_processes: ProcessInfo[];
  };
  disk: {
    used_mb: number;
    total_mb: number;
    key_dirs: DiskDirectoryUsage[];
  };
  load: {
    one: number;
    five: number;
    fifteen: number;
  };
  tailscale_ip: string | null;
  uptime_seconds: number;
}

export interface UsageProfile {
  id: string;
  label: string;
  profile: string;
  model: string;
  tokens_used: number;
  tokens_limit: number;
  requests_used: number;
  requests_limit: number;
  reset_at: string | null;
  active: boolean;
}

export interface RateLimitsResponse {
  cached: boolean;
  stale: boolean;
  profiles: UsageProfile[];
}

// ─── Ideas ──────────────────────────────────────────────────────────────────

export type IdeaStatus = 'draft' | 'brainstorming' | 'artifact_ready' | 'approved' | 'in_work' | 'archived';

export interface Idea {
  id: string;
  title: string;
  body: string;
  status: IdeaStatus;
  created_at: string;
  updated_at: string;
  tags: string[];
  target_agent: string;
  target_project: string;
  artifact_md: string | null;
  artifact_generated_at: string | null;
  task_id: string | null;
  brainstorm_session_id: string | null;
}
