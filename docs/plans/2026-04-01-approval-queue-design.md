# Approval Queue Design

Date: 2026-04-01
Issue: `#164`

## Goal
Add a first-class approval lane for ideas that need an operator decision, with durable `Yes`, `Later`, `No`, and `Rescope` actions and truthful routing results.

## Constraints
- Use existing dashboard design tokens only.
- Keep backend DRY by delegating task creation / decision logging to existing CLIs.
- Stay compatible with mixed idea data already on disk, including legacy `reviewed` ideas.
- `Yes` must create or surface a real task, not just flip UI state.

## Chosen approach
Extend idea records with a durable `approval` object instead of replacing the existing top-level `status` field. This preserves legacy `draft` / `artifact_ready` / `approved` flows while introducing approval-lane truth for new states.

Add a dedicated `/api/ideas/approval-queue` read endpoint plus `/api/ideas/:id/decision` write endpoint. The queue endpoint will normalize both explicit approval records and legacy approval-like ideas (`artifact_ready`, `reviewed`) into a consistent card shape. The decision endpoint will:
- validate current approval state
- reject stale / duplicate submissions
- persist the decision back to the idea JSON file
- on `Yes`, call the existing task-store-backed task creation path and attach the routed task id
- log durable task events / decisions when a task exists

## Data model
Idea JSON gains an optional `approval` block:

```json
{
  "approval": {
    "state": "pending|later|no|rescope|routed|routing_failed",
    "requested_at": "ISO-8601",
    "reason": "why approval is needed",
    "route": "artifact_route",
    "expected_outcome": "strategy_doc",
    "owner": "platon",
    "next_action": "Await operator decision",
    "pending_since": "ISO-8601",
    "decided_at": "ISO-8601|null",
    "decided_by": "dashboard",
    "decision_note": "optional operator note",
    "task_id": "tsk_...",
    "error": "routing failure text|null"
  }
}
```

Legacy mapping rules:
- `artifact_ready` with no `approval` becomes a synthetic pending approval card.
- `reviewed` with `review_note` becomes a synthetic pending approval card using the note as the approval reason.
- `approved` plus `task_id` becomes routed, but only if an explicit approval object already exists.

## UI
Add an approval queue section at the top of `/ideas`:
- clear header with count
- loading skeletons
- empty state
- error state
- compact decision cards showing title, reason, route/outcome, owner, freshness, and next action
- inline action buttons with duplicate-submit protection
- stale and routing-failure states rendered truthfully

Keep the existing ideas grid below the queue. Approval cards remain visible for `pending`, `later`, `no`, `rescope`, and `routing_failed`. `routed` cards can stay visible in a resolved state with the linked task id so the operator can verify the real artifact routing result.

## Error handling
- Duplicate click: disable the active card while the request is in flight.
- Stale item resolved elsewhere: server returns conflict / stale error; client refetches and shows the updated truth.
- Routing failure after `Yes`: persist `routing_failed` with the error text so the card stays visible.

## Testing
- Server tests for queue listing, legacy normalization, each decision path, stale decision rejection, duplicate `Yes` protection, and routing failure persistence.
- Client tests for loading / empty / error states, card rendering, action submission, stale errors, and routed-task visibility.
