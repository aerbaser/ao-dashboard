// Task-related types matching task-store.js output shapes

export interface TaskContract {
  schema_version: string
  task_id: string
  title: string
  raw_request: string
  outcome_type: string
  delivery_mode: string
  route: string
  full_solution: boolean
  approval_policy: string
  design_approval_mode: string
  required_gates: string[]
  owner_map: Record<string, string>
  success_definition: string[]
  constraints: string[]
  created_at: string
}

export interface TaskStatus {
  schema_version: string
  task_id: string
  state: string
  current_owner: string
  current_route: string
  last_event_id: string
  blockers: string[]
  retries: number
  deadline_at: string | null
  updated_at: string
  last_material_update?: string
  next_action: string
}

export interface TaskEvent {
  event_id: string
  event_type: string
  task_id: string
  actor: string
  timestamp: string
  from_state?: string | null
  to_state?: string
  [key: string]: unknown
}

export interface TaskDecision {
  decision_id: string
  task_id: string
  gate_type: string
  resolved_by: string
  resolved_at: string
  resolution_mode: string
  summary: string
  [key: string]: unknown
}

export interface TaskDetail {
  task_id: string
  contract: TaskContract
  status: TaskStatus
  events: TaskEvent[]
  decisions: TaskDecision[]
}

export interface TaskListItem {
  task_id: string
  contract: TaskContract
  status: TaskStatus
}
