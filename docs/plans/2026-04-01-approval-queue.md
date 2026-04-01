# Approval Queue Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Ideas approval lane with durable Yes/Later/No/Rescope actions and real task routing.

**Architecture:** Extend idea JSON records with a durable approval block, expose queue + decision endpoints from the ideas API, and render a dedicated approval-lane section on `/ideas` using the new endpoint. `Yes` routes through the existing task-store-backed task creation path and persists truthful result states.

**Tech Stack:** Express, React, TypeScript, Vitest, Testing Library, existing task-store CLI wrappers

---

### Task 1: Branch and docs

**Files:**
- Create: `docs/plans/2026-04-01-approval-queue-design.md`
- Create: `docs/plans/2026-04-01-approval-queue.md`

**Step 1: Confirm branch**

Run: `git branch --show-current`
Expected: `feat/164`

**Step 2: Save the design + plan docs**

Expected: both files exist under `docs/plans/`

### Task 2: Server tests for approval queue contract

**Files:**
- Modify: `tests/server/ideas-api.test.ts`

**Step 1: Write failing tests for queue listing**

Cover:
- explicit approval pending item
- legacy `artifact_ready`
- legacy `reviewed`
- empty queue

**Step 2: Run only the ideas API tests**

Run: `npm test -- tests/server/ideas-api.test.ts`
Expected: FAIL on missing queue endpoint / decision logic

### Task 3: Backend queue contract

**Files:**
- Modify: `server/api/ideas.js`

**Step 1: Implement approval normalization helpers**

Add:
- durable approval state constants
- legacy-to-queue normalization
- stale / duplicate decision guards

**Step 2: Implement queue read endpoint**

Add: `GET /api/ideas/approval-queue`

**Step 3: Implement decision write endpoint**

Add: `POST /api/ideas/:id/decision`

**Step 4: Route `Yes` through real task creation**

Use existing task-store CLI path and persist routed task id or routing error.

**Step 5: Re-run server tests**

Run: `npm test -- tests/server/ideas-api.test.ts`
Expected: PASS

### Task 4: Client tests for approval lane UI

**Files:**
- Modify: `tests/client/ideas.test.tsx`

**Step 1: Write failing tests for render states**

Cover:
- loading
- empty
- error
- pending card content
- later / no / rescope / routed status rendering

**Step 2: Write failing tests for action flow**

Cover:
- button dispatches decision call
- buttons disable while submitting
- stale error refetch path

**Step 3: Run only the ideas client tests**

Run: `npm test -- tests/client/ideas.test.tsx`
Expected: FAIL until UI and client API are implemented

### Task 5: Client API + Ideas page

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/pages/IdeasPage.tsx`
- Modify: `src/components/ideas/IdeaCard.tsx`
- Create: `src/components/ideas/ApprovalQueue.tsx`
- Create: `src/components/ideas/ApprovalDecisionCard.tsx`

**Step 1: Add approval queue types + client calls**

**Step 2: Render approval queue section above the ideas grid**

**Step 3: Wire card actions to the backend**

**Step 4: Keep existing ideas grid behavior intact**

**Step 5: Re-run client tests**

Run: `npm test -- tests/client/ideas.test.tsx`
Expected: PASS

### Task 6: Verification and delivery

**Files:**
- Modify: any touched implementation files as needed

**Step 1: Run targeted tests**

Run: `npm test -- tests/server/ideas-api.test.ts tests/client/ideas.test.tsx tests/client/ideas-legacy-status.test.tsx`

**Step 2: Run lint + typecheck**

Run: `npm run lint`
Run: `npm run typecheck`
Run: `npm run typecheck:server`

**Step 3: Commit**

```bash
git add docs/plans/2026-04-01-approval-queue-design.md docs/plans/2026-04-01-approval-queue.md server/api/ideas.js src/lib/api.ts src/lib/types.ts src/pages/IdeasPage.tsx src/components/ideas/ApprovalQueue.tsx src/components/ideas/ApprovalDecisionCard.tsx src/components/ideas/IdeaCard.tsx tests/server/ideas-api.test.ts tests/client/ideas.test.tsx tests/client/ideas-legacy-status.test.tsx
git commit -m "feat(#164): add approval queue decision lane"
```
