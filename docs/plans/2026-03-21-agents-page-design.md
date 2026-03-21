# Agents Page Design

**Issue:** `#6`

**Goal:** Complete the remaining functional gaps in the Agents page so the existing implementation fully matches the issue contract.

## Context

The current branch already implements the basic Agents grid, detail drawer, mailbox viewer, and server write routes. The audit against issue `#6` found three material gaps:

1. `/api/events` still returns a stubbed empty array instead of aggregating task events for the selected agent.
2. The detail drawer `Info` tab does not expose `session_key`, `workspace path`, `topic_id`, or the raw heartbeat payload.
3. The `Comm Log` tab renders markdown, while the contract calls for raw markdown text.

## Recommended Approach

Use the existing `GET /api/agents` payload as the primary source for card data, and enrich it with lightweight session metadata plus the raw heartbeat object. Keep mailbox and message routes as implemented. Add a small server-side event aggregation helper that scans `~/clawd/tasks/**/events.ndjson`, filters by `actor === agentId`, sorts newest-first, and returns JSON directly to the existing `/api/events?agent=` route.

This approach is preferred over adding new backend resources because it keeps the frontend simple, avoids duplicate fetches for agent metadata, and reuses the current poll-driven data model.

## Data Design

Each agent record returned from `GET /api/agents` should include:

- `session_key`
- `workspace_path`
- `topic_id`
- `heartbeat_raw`

These fields are derived from the latest session record in `~/.openclaw/agents/<agent>/sessions/sessions.json` plus the heartbeat JSON already being read.

The `/api/events` route should:

- require an `agent` query param
- read active and archived task event files
- parse newline-delimited JSON safely
- filter to events whose `actor` matches the requested agent id
- sort by `timestamp` descending

## UI Design

Keep the current drawer layout and Leo token usage. Make these focused adjustments:

- `Info` tab shows session metadata and the raw heartbeat JSON in a monospace `<pre>`
- `Comm Log` tab shows raw markdown text, not rendered markdown
- `Events` tab continues to render JSON entries, now backed by real data

## Error Handling

- Missing session metadata remains non-fatal and renders as `unknown`
- Missing heartbeat remains non-fatal and preserves the existing unknown-state card behavior
- Malformed event lines are skipped rather than failing the whole endpoint

## Testing

Add targeted server-side tests for:

- extracting the latest session metadata from a sessions file
- aggregating and sorting agent events from multiple `events.ndjson` files

Delegated design approval is assumed from `contract.json` and the detailed GitHub issue spec.
