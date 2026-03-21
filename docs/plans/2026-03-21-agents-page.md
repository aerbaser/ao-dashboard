# Agents Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining issue `#6` gaps on the Agents page by adding real event aggregation, complete agent metadata for the Info tab, and raw Comm Log rendering.

**Architecture:** Keep the existing server-router and poll-driven React UI. Extend `GET /api/agents` with derived session metadata and raw heartbeat content, and replace the stubbed `/api/events` handler with filesystem-backed aggregation from task event logs.

**Tech Stack:** Express, React, TypeScript, Tailwind, Node built-in test runner

---

### Task 1: Add server tests for the missing data helpers

**Files:**
- Create: `server/api/agents.test.js`
- Modify: `server/api/agents.js`

**Step 1: Write the failing test**

Write tests for:

- latest session metadata extraction from `sessions.json`
- event aggregation across multiple `events.ndjson` files filtered by `actor`

**Step 2: Run test to verify it fails**

Run: `node --test server/api/agents.test.js`
Expected: FAIL because helper exports do not exist yet.

**Step 3: Write minimal implementation**

Export helper functions from `server/api/agents.js` for:

- reading latest session metadata
- parsing NDJSON event files
- aggregating agent events

**Step 4: Run test to verify it passes**

Run: `node --test server/api/agents.test.js`
Expected: PASS

**Step 5: Commit**

Commit after the task if the repo is in a good state.

### Task 2: Wire the server routes to the new data

**Files:**
- Modify: `server/api/agents.js`
- Modify: `server/index.js`

**Step 1: Write the failing test**

Extend the server tests to assert the derived metadata shape returned by the helper input data.

**Step 2: Run test to verify it fails**

Run: `node --test server/api/agents.test.js`
Expected: FAIL on missing fields or wrong sorting.

**Step 3: Write minimal implementation**

- include `session_key`, `workspace_path`, `topic_id`, and `heartbeat_raw` in agent responses
- replace the `/api/events` stub with the aggregation helper

**Step 4: Run test to verify it passes**

Run: `node --test server/api/agents.test.js`
Expected: PASS

**Step 5: Commit**

Commit after the task if the repo is in a good state.

### Task 3: Update the UI for the completed data contract

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/components/agents/AgentDetail.tsx`

**Step 1: Write the failing test**

No existing frontend test harness is present, so verification is by typecheck/build plus runtime inspection.

**Step 2: Run verification to expose the current gap**

Run: `npm run typecheck`
Expected: PASS before the UI changes.

**Step 3: Write minimal implementation**

- extend `AgentInfo` with the new metadata fields
- render `Comm Log` as raw text in a monospace preformatted block
- render `Info` tab session metadata and raw heartbeat JSON

**Step 4: Run verification to verify it passes**

Run: `npm run typecheck`
Expected: PASS

**Step 5: Commit**

Commit after the task if the repo is in a good state.

### Task 4: Verify and ship

**Files:**
- Modify: none

**Step 1: Run lint**

Run: `npm run lint`
Expected: PASS

**Step 2: Run typechecks**

Run: `npm run typecheck && npm run typecheck:server`
Expected: PASS

**Step 3: Run build**

Run: `npm run build`
Expected: PASS

**Step 4: Run targeted runtime checks**

Run the issue verification curl commands against a local server.

**Step 5: Commit**

Use a conventional commit message referencing issue `#6`.
