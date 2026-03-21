const BASE = '/api';

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
  mailbox: {
    inbox: number;
    processing: number;
    done: number;
    deadletter: number;
  };
}

export interface Envelope {
  id: string;
  from: string;
  type: string;
  subject: string;
  priority: string;
  created_at: string;
  expires_at: string | null;
  payload?: unknown;
}

export interface AgentEvent {
  event_id?: string;
  event_type?: string;
  task_id?: string;
  actor?: string;
  timestamp?: string;
  [key: string]: unknown;
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
  const data = await res.json();
  return data.content;
}

export async function fetchAgentLog(agentId: string): Promise<string> {
  const res = await fetch(`${BASE}/agents/${agentId}/log`);
  if (!res.ok) throw new Error(`Failed to fetch log: ${res.status}`);
  const data = await res.json();
  return data.content;
}

export async function fetchAgentEvents(agentId: string): Promise<AgentEvent[]> {
  const res = await fetch(`${BASE}/events?agent=${agentId}`);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  return res.json();
}

export async function sendAgentMessage(agentId: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function wakeAgent(agentId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/wake`, {
    method: 'POST',
  });
  return res.json();
}

export async function deleteEnvelope(agentId: string, folder: string, envelopeId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/mailbox/${folder}/${envelopeId}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function moveEnvelope(agentId: string, fromFolder: string, toFolder: string, envelopeId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/mailbox/${fromFolder}/${envelopeId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: toFolder }),
  });
  return res.json();
}
