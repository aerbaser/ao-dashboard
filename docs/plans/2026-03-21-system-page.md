# System Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the System page and its services, cron, vitals, and rate-limit APIs for issue `#7`.

**Architecture:** Add dedicated Express routers for each System domain, expand shared vitals helpers for real machine data, and build four polling React components on top of typed API helpers. Keep the UI aligned with the existing tokenized Tailwind theme and enforce server-side guards for service actions and cron validation.

**Tech Stack:** Express, React, TypeScript, Tailwind CSS, Vitest, Testing Library

---

### Task 1: Add test harness and backend red tests

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `server/api/services.js`
- Create: `server/api/cron.js`
- Create: `server/api/vitals.js`
- Create: `tests/server/system-api.test.ts`

**Step 1: Write the failing test**

- Add Vitest and server tests covering:
  - forbidden service POST returns `403`
  - invalid cron POST returns `400`
  - vitals response exposes `cpu.per_core` with length `16`
  - rate-limit normalization yields required display rows

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/system-api.test.ts`

Expected: FAIL because the routes do not exist yet.

**Step 3: Write minimal implementation**

- Add the missing routers and register them in `server/index.js`.
- Export pure helpers where route tests need deterministic coverage.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/system-api.test.ts`

Expected: PASS

### Task 2: Implement full system data readers

**Files:**
- Modify: `server/api/rate-limits.js`
- Modify: `server/lib/vitals.js`
- Create: `server/lib/system.js`
- Test: `tests/server/system-api.test.ts`

**Step 1: Write the failing test**

- Extend tests for:
  - cron parsing/rendering round-trip
  - forbidden matching with wildcard rules
  - service grouping metadata
  - rate-limit switch payload validation

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/system-api.test.ts`

Expected: FAIL on the newly added assertions.

**Step 3: Write minimal implementation**

- Implement pure helpers for service metadata, forbidden matching, cron parsing/validation/rendering, vitals sampling, and rate-limit normalization.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/system-api.test.ts`

Expected: PASS

### Task 3: Add frontend red tests and typed API surface

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/types.ts`
- Create: `src/components/system/ServicesGrid.tsx`
- Create: `src/components/system/CronCalendar.tsx`
- Create: `src/components/system/ServerVitals.tsx`
- Create: `tests/client/system-page.test.tsx`

**Step 1: Write the failing test**

- Add client tests covering:
  - Services grid groups and forbidden disable state
  - Vitals heatmap rendering of 16 CPU cells
  - Usage progress threshold coloring logic

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/client/system-page.test.tsx`

Expected: FAIL because the components and types are incomplete.

**Step 3: Write minimal implementation**

- Add typed client fetchers and build the three components around them.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/client/system-page.test.tsx`

Expected: PASS

### Task 4: Build CronCalendar interactions and page composition

**Files:**
- Modify: `src/pages/SystemPage.tsx`
- Modify: `src/components/system/UsageTracker.tsx`
- Modify: `src/components/system/CronCalendar.tsx`
- Test: `tests/client/system-page.test.tsx`

**Step 1: Write the failing test**

- Extend client tests for:
  - countdown formatting
  - switch-profile action callback
  - cron job block rendering and inline edit state

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/client/system-page.test.tsx`

Expected: FAIL on new UI behavior.

**Step 3: Write minimal implementation**

- Finish the System page composition, polling, editing flows, and feedback states.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/client/system-page.test.tsx`

Expected: PASS

### Task 5: Verify and ship

**Files:**
- Modify: `server/index.js`
- Modify: `src/index.css`
- Test: `tests/server/system-api.test.ts`
- Test: `tests/client/system-page.test.tsx`

**Step 1: Run targeted verification**

Run:
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run typecheck:server`

**Step 2: Run issue-specific verification**

Run:
- `curl http://localhost:3333/api/services | jq 'map(select(.forbidden==true)) | length'`
- `curl -i -X POST http://localhost:3333/api/services/openclaw-gateway/restart`
- `curl http://localhost:3333/api/vitals | jq '.cpu.per_core | length'`
- `curl http://localhost:3333/api/rate-limits | jq '.[0].tokens_limit'`
- `curl -s -X POST http://localhost:3333/api/cron -H 'Content-Type: application/json' -d '{"entries":[{"schedule":"invalid","command":"echo test","enabled":true}]}' | jq .error`

**Step 3: Commit**

```bash
git add docs/plans package.json vite.config.ts server src tests
git commit -m "feat: implement system page and APIs (#7)"
```
