# AO Dashboard v2 — Design Document

**Date:** 2026-03-28  
**Author:** Brainstorm-Claude  
**Status:** Ready for UX Design (Leo) → Issues (Platon) → Implementation (Archimedes)  
**Repo:** aerbaser/ao-dashboard  
**Stack:** Express + React/TS + Vite + Tailwind  
**Design language:** Terminal Intelligence

---

## Context

Dashboard v2 adds three major features to the existing pipeline control panel:

| Feature | ID | Priority |
|---------|-----|---------|
| Kanban Live Tasks | F1 | High |
| Ideas Tab | F2 | High |
| Agents Hierarchy | F3 | Medium |

Current foundation:
- KanbanBoard with DnD kit (18 pipeline columns)
- Tasks from `~/clawd/tasks/tsk_*/status.json + contract.json + events.ndjson`
- Agents from heartbeats + `AGENT_META` hardcoded array
- `/api/tasks`, `/api/agents`, `/api/config/gateway` APIs
- `usePolling` hook, `react-markdown`, `@dnd-kit` already installed

---

## F1: Kanban Live Tasks

### Core Problem
The existing Kanban shows v8 pipeline states (INTAKE→DONE) — 18 columns. Agents need a way to block on Yura's decision and Yura needs a dedicated view for "what needs my attention now."

### Design Decisions (from brainstorm)

**Q1 — "Awaiting Yura" mechanism → AWAITING_OWNER state (confirmed by Socrates)**

New canonical state added to task-store schema:
```
AWAITING_OWNER
```
- Position: between EXECUTION and REVIEW_PENDING in flow
- Meaning: task is paused, waiting for Yura's decision/comment
- Agent triggers: `node task-store.js transition tsk_xxx AWAITING_OWNER --actor archimedes`
- After Yura responds: agent transitions back to EXECUTION or forward to REVIEW_PENDING
- NOT the same as `WAITING_USER` (that's for external user delays, not owner decisions)
- Added to `DEFAULT_STATE_OWNERS`: owner = `sokrat` (escalation coordinator)

**Q2 — Comment mechanism → USER_COMMENT event in events.ndjson (confirmed by Socrates)**

When Yura types a comment on a card in the dashboard:
1. Dashboard POST `/api/tasks/:id/event` with `{ type: "USER_COMMENT", payload: { body: "...", author: "yura" } }`
2. Appended to `tasks/tsk_xxx/events.ndjson`
3. Agent on next wake reads new events, finds `USER_COMMENT`
4. Agent transitions `AWAITING_OWNER → EXECUTION` and continues

**Q3 — Real-time updates → Polling (5s for Kanban/Ideas, 30s for Agents)**

Decision: extend `usePolling` with configurable intervals. No SSE for v1 (complexity vs. benefit ratio too high for local single-user tool). SSE can be added in v2.1 as enhancement.

### UI Spec

**New column: "⏳ Awaiting Owner"**
- Color: `#F59E0B` (amber — attention-requiring)
- Position: between EXECUTION and REVIEW_PENDING columns
- Cards in this column: highlighted with amber left-border + pulsing dot indicator
- Badge: count shown in TopBar notification area

**Task card enhancements (all cards):**
- **Flow strip**: compact horizontal list of agents that touched the task (from events.ndjson `actor` field): `🦉→🔧→🧠`
- **Comment button** (only on AWAITING_OWNER cards): opens inline comment input
- **Comment input**: textarea + Submit button → POST to `/api/tasks/:id/event`
- **Comments thread**: accordion showing past USER_COMMENT events

**Column "Awaiting Owner" — special behavior:**
- Auto-sorts by `deadline_at` ascending (urgent first)
- Pulsing amber ring on card border if `deadline_at < now + 1h`
- Click on card → TaskDetail drawer opens (existing component, enhanced)

### New API endpoints

```
POST /api/tasks/:id/event
  { type: "USER_COMMENT", payload: { body: string } }
  → Appends to events.ndjson (already exists, just add USER_COMMENT type)

GET /api/tasks?state=AWAITING_OWNER
  → Filter tasks by state (add query param support to existing GET /api/tasks)
```

### task-store.js changes

```js
// Add to CANONICAL_STATES:
'AWAITING_OWNER'

// Add to DEFAULT_STATE_OWNERS:
AWAITING_OWNER: 'sokrat'

// Add to STATE_COLORS in KanbanBoard.tsx:
AWAITING_OWNER: '#F59E0B'
```

### Polling Strategy

```ts
// usePolling intervals:
KANBAN: 5_000ms   // Tasks change often, need fresh state
IDEAS:  5_000ms   // Brainstorm can complete quickly
AGENTS: 30_000ms  // Heartbeats update every 10min, no rush
SYSTEM: 30_000ms  // Cron, vitals — low urgency
```

---

## F2: Ideas Tab

### Core Problem
Yura needs a place to capture raw ideas, trigger AI brainstorm on them, review the artifact, and convert to actionable tasks — all from the dashboard UI.

### Design Decisions

**Storage → ~/clawd/ideas/ directory (one JSON file per idea)**

Pattern mirrors task-store: each idea gets its own file.

```
~/clawd/ideas/
  idea_20260328_abc123.json    ← main idea file
  idea_20260328_def456.json
```

Idea schema:
```json
{
  "id": "idea_20260328_abc123",
  "title": "...",
  "body": "full description from Yura",
  "status": "draft|brainstorming|artifact_ready|approved|in_work|archived",
  "created_at": "ISO",
  "updated_at": "ISO",
  "tags": [],
  "target_agent": "brainstorm-claude|sokrat|archimedes",
  "target_project": "ao-dashboard|sokrat-core|...",
  "artifact_md": null,
  "artifact_generated_at": null,
  "task_id": null,
  "brainstorm_session_id": null
}
```

**Brainstorm trigger → POST /api/ideas/:id/brainstorm → writes to agent INBOX**

Flow:
1. Yura clicks "⚡ Brainstorm" on idea card
2. Dashboard writes brainstorm request to `~/.openclaw/shared-memory/communication/inbox_brainstorm.md` (or brainstorm-claude mailbox)
3. Dashboard updates idea status → `brainstorming`
4. Brainstorm agent wakes, reads idea body, produces MD artifact
5. Agent writes `artifact_md` to `idea_xxx.json`, updates `status: artifact_ready`
6. Dashboard polls, shows artifact in card (react-markdown renderer, existing dep)

**Approve flow:**
1. Yura reviews artifact → clicks "✅ Approve"
2. Dashboard POST `/api/ideas/:id/approve`
3. Server: create task via task-store.js → write `task_id` to idea → update `status: in_work`
4. Write decomposition request to Platon's INBOX
5. Dashboard shows task link in idea card

### UI Spec

**Ideas Tab** (new top-level nav item, sidebar position: after Pipeline, before Agents)

**Idea card states:**

| Status | Color | Actions |
|--------|-------|---------|
| draft | gray | Edit, Brainstorm, Archive |
| brainstorming | blue (pulse) | — (processing) |
| artifact_ready | green | View Artifact, Approve, Reject, Edit |
| approved | teal | View Task |
| in_work | indigo | View Task |
| archived | dark gray | Unarchive |

**New idea input:**
- Fixed at top of Ideas page
- Simple form: Title + Body (textarea) + Target Agent (select) + Tags
- "Create" → POST `/api/ideas` → card appears in draft status

**Artifact display:**
- Expandable panel inside card
- `react-markdown` with `remark-gfm` (already installed)
- Copy button (existing CopyButton component)
- "Edit Artifact" → inline MD editor (textarea → save)

**Brainstorm agent inbox write format:**
```md
## [IDEA-BRAINSTORM] idea_20260328_abc123

**Title:** <title>
**Body:** <body>
**Context:** <tags, project>

Produce: design doc / brainstorm artifact.
Write result to: ~/clawd/ideas/idea_20260328_abc123.json field artifact_md.
Update status to artifact_ready.
```

### New API endpoints

```
GET    /api/ideas              → list all ideas
POST   /api/ideas              → create idea
GET    /api/ideas/:id          → get idea detail
PATCH  /api/ideas/:id          → update idea (body, tags, status, artifact_md)
POST   /api/ideas/:id/brainstorm → trigger brainstorm (write to inbox)
POST   /api/ideas/:id/approve  → create task + notify Platon
POST   /api/ideas/:id/archive  → status → archived
DELETE /api/ideas/:id          → delete (with confirmation)
```

### New server file: server/api/ideas.js

---

## F3: Agents Hierarchy

### Core Problem
Current AgentsPage shows a flat grid of agent cards. Need: org chart visualization, skills management, MD file editor, model configuration.

### Design Decisions

**Org chart → CSS/SVG tree (no extra lib needed)**

Hierarchy (from openclaw.json + AGENTS.md):
```
🦉 Сократ (main)
├── 🔧 Архимед (archimedes) — Engineering
├── 📚 Аристотель (aristotle) — Research  
├── 📜 Геродот (herodotus) — Publishing
├── 🏛️ Платон (platon) — Architecture/Planning
├── ⚒️ Гефест (hephaestus) — Infrastructure
├── 🎨 Лео (leo) — Design
├── 🧠 Brainstorm Claude — Ideation
└── 💡 Brainstorm Codex — Ideation
```

Implementation: pure CSS flexbox tree with SVG lines. No new deps. "Terminal Intelligence" aesthetic: mono font, green accent lines.

**Skills management → Toggle from UI → write openclaw.json**

Each agent card shows:
- Active skills (checkboxes, can uncheck to remove)  
- "Add skill" dropdown (all 58 available skills in ~/.openclaw/skills/)
- Changes write to openclaw.json via new `/api/agents/:id/skills` endpoint
- Requires confirmation modal: "This will reload agent configuration"
- After write: `openclaw gateway restart` (or config hot-reload if supported)

**MD editor → inline in agent panel**

Files editable:
- `~/.openclaw/workspace-{agent}/AGENTS.md`
- `~/.openclaw/workspace-{agent}/SOUL.md`
- `~/.openclaw/workspace-{agent}/TOOLS.md` (if exists)

UI: click "Edit AGENTS.md" → inline textarea with MD preview split view → Save button → write file via API.

**Model change → UI with confirmation + restart warning**

Available models (from openclaw.json patterns):
- `anthropic/claude-opus-4-6`
- `anthropic/claude-sonnet-4-6`
- `anthropic/claude-haiku-4-6`
- `openai/gpt-4o`
- (extensible)

Decision (default, Q5 timeout): **Option B** — Edit model via UI → write openclaw.json → require explicit Yura confirmation → gateway restart. NOT hot-swap (too risky without testing). The restart takes ~30s and is announced in the dashboard.

### UI Spec

**New layout for Agents page:**

```
┌─────────────────────────────────────────────────────┐
│ [Org Chart View] [Grid View]          [+ New Agent] │
├─────────────────────────────────────────────────────┤
│           Org Chart (default view)                  │
│                   🦉 Сократ                         │
│           ┌───┬───┬───┬───┬───┐                    │
│          🔧  📚  📜  🏛️  ⚒️  🎨                    │
│                                                     │
│  [Click any node → expand panel below]             │
├─────────────────────────────────────────────────────┤
│ Agent Detail Panel (expanded on click)              │
│ ┌──────────┐  Status: ● active                     │
│ │  🔧      │  Model: claude-opus-4-6 [Change▼]     │
│ │ Архимед  │  Last seen: 2m ago                    │
│ └──────────┘  Current task: tsk_20260327_abc       │
│                                                     │
│ Skills ─────────────────────────────────────────   │
│ ✅ coding-agent  ✅ github  ✅ superpowers  [+Add]  │
│                                                     │
│ Files ──────────────────────────────────────────   │
│ [AGENTS.md] [SOUL.md] [TOOLS.md]                   │
│ ┌──────────────────────────────────────────┐       │
│ │ # AGENTS.md — Архимед                   │       │
│ │ ...editable textarea...                 │       │
│ └──────────────────────────────────────────┘       │
│                              [Save] [Discard]       │
└─────────────────────────────────────────────────────┘
```

**Agent node in org chart:**
- Colored by status: green=active, gray=idle, amber=waiting, red=dead
- Shows: emoji + name + role
- Click → expand detail panel (slide-in from right or expand below)
- Hover → tooltip: last_seen, current_task

### New API endpoints

```
GET  /api/agents/:id/files          → list editable MD files
GET  /api/agents/:id/files/:name    → read file content (AGENTS.md, SOUL.md, TOOLS.md)
PUT  /api/agents/:id/files/:name    → write file content
GET  /api/agents/:id/skills/available → list all skills in ~/.openclaw/skills/
POST /api/agents/:id/skills/add     → add skill to agent's openclaw.json
POST /api/agents/:id/skills/remove  → remove skill from agent's openclaw.json
PATCH /api/agents/:id/model         → change model (requires restart flag)
POST /api/agents/restart-gateway    → trigger openclaw gateway restart (requires confirm)
```

---

## Implementation Plan

### Phase 1: Data layer (no UI)
1. Add `AWAITING_OWNER` to task-store.js canonical states
2. Create `/api/tasks?state=` query filter
3. Create `server/api/ideas.js` (CRUD + brainstorm + approve)
4. Create `server/api/agents/:id/files` endpoints  
5. Create `server/api/agents/:id/skills` endpoints

### Phase 2: F1 Kanban enhancements
1. Add `AWAITING_OWNER` column with amber styling
2. Add flow strip to TaskCard (parse events.ndjson actors)
3. Add comment UI to TaskCard for AWAITING_OWNER state
4. Reduce polling to 5s for Pipeline page

### Phase 3: F2 Ideas Tab
1. New page `src/pages/IdeasPage.tsx`
2. IdeaCard component with status lifecycle
3. Artifact panel with react-markdown renderer
4. New idea form

### Phase 4: F3 Agents Hierarchy
1. Org chart component (CSS tree + SVG lines)
2. Agent detail panel (slide-in)
3. Skills checklist + add dropdown
4. MD file editor (split view: edit + preview)
5. Model selector with confirmation modal

---

## Design System Notes (Terminal Intelligence)

Stay consistent with existing palette:
- `bg-bg-void`, `bg-bg-overlay`, `bg-bg-base` for backgrounds
- `text-text-primary`, `text-text-muted` for text
- `border-border-subtle` for dividers
- Monospace font for all data/code/IDs
- Color accent per agent (use emoji as identity anchor, not photos)
- Amber `#F59E0B` for "needs attention" states
- No shadows, no gradients — flat terminal aesthetic

---

## Open Questions (for Leo UX pass)

1. Should Ideas tab show as separate page or as a panel in Pipeline page?
2. Org chart: vertical tree (top-down) or horizontal (left-right)?
3. MD editor: full-screen overlay or inline split view?
4. Should model change require typing agent name (like GitHub destructive actions)?

---

## Files to Create/Modify

```
MODIFY:
  clawd/scripts/task-store.js           ← add AWAITING_OWNER state
  ao-dashboard/server/api/tasks.js      ← add ?state= filter  
  ao-dashboard/server/api/agents.js     ← add files + skills endpoints
  ao-dashboard/server/index.js          ← register ideasRouter
  ao-dashboard/src/components/pipeline/KanbanBoard.tsx  ← new column
  ao-dashboard/src/components/pipeline/TaskCard.tsx     ← flow strip + comment
  ao-dashboard/src/pages/AgentsPage.tsx                 ← org chart layout
  ao-dashboard/src/App.tsx                              ← add Ideas route

CREATE:
  ao-dashboard/server/api/ideas.js
  ao-dashboard/src/pages/IdeasPage.tsx
  ao-dashboard/src/components/ideas/IdeaCard.tsx
  ao-dashboard/src/components/ideas/IdeaForm.tsx
  ao-dashboard/src/components/ideas/ArtifactPanel.tsx
  ao-dashboard/src/components/agents/OrgChart.tsx
  ao-dashboard/src/components/agents/AgentDetailPanel.tsx
  ao-dashboard/src/components/agents/SkillsManager.tsx
  ao-dashboard/src/components/agents/MdFileEditor.tsx
  ao-dashboard/src/components/agents/ModelSelector.tsx
```

---

*Generated by brainstorm-claude | Task: tsk_20260327_dashboard_v2 | Session: brainstorm-dashboard-v2*
