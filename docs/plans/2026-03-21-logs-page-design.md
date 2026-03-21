# Logs Page Design

## Scope

Issue `#8` finishes the Logs surface across server and client:

- Gateway log tail from `/api/logs/gateway`
- Worker log file list and per-file tail
- DecisionTrail aggregated from task decision logs
- EventStream aggregated from task event logs

## Current State

The branch already contains a partial implementation, but it has three gaps against the spec:

1. The server only scans `~/clawd/tasks/active/*`, while real decision and event files in this environment live under `~/clawd/tasks/tsk_*`.
2. Decision and event payloads are not normalized to the UI schema. Real files use fields like `resolved_by`, `resolved_at`, and `event_type`.
3. The log viewer UX is close but incomplete for the requested filter model and event/decision presentation quality.

## Recommended Approach

Keep the existing route and component structure, then harden it instead of rewriting it:

- Normalize data at the server boundary so the client can render one consistent shape.
- Keep log filtering client-side and virtualized.
- Use small pure helpers for normalization and summarization so the code is testable with `node:test` without adding a new test stack.

## Data Flow

- `GET /api/logs/gateway?lines=N`
  reads the Lisbon-day gateway log and returns the last `N` lines with file metadata.
- `GET /api/logs/worker`
  returns log filenames plus sizes from `/tmp/openclaw`.
- `GET /api/logs/worker/:name?lines=N`
  tails the selected worker file.
- `GET /api/decisions`
  scans task directories, parses `decision-log.jsonl`, normalizes the fields, sorts by newest first, and supports query filters.
- `GET /api/events`
  scans task directories, parses `events.ndjson`, normalizes the fields, sorts by newest first, and supports query filters.

## Client Design

- `Logs.tsx` remains the tab shell and owns gateway polling plus worker file selection.
- `LogViewer.tsx` handles level filters, keyword filter, virtual scrolling, JSON expansion, and pause-aware auto-scroll.
- `DecisionTrail.tsx` renders normalized rows with sortable columns and local filters.
- `EventStream.tsx` renders normalized events with icon mapping and human-readable summaries from top-level event fields.

## Error Handling

- Missing gateway file returns `200` with an `error` message and empty `lines`.
- Missing worker file returns `404`.
- Missing decision/event files in some task directories are ignored.
- Invalid NDJSON lines are skipped rather than failing the full request.

## Verification

- Add a server integration test for `/api/decisions` and `/api/events` using the real task layout in this environment.
- Run `lint`, app `typecheck`, server `typecheck`, and the targeted server test.
- Run the issue curl checks against a local server instance.
