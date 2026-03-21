# Rate-Limits Cache Reader + /api/status Aggregator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire rate-limits cache reader, profile switching, and a fast /api/status aggregator endpoint with server-side TTL caching.

**Architecture:** Server-side TTL cache using `Map<string, {data, expires_at}>` in server/index.js. Rate-limits reads from `~/clawd/runtime/rate-limit-cache.json`. Status endpoint aggregates 12 fields from heartbeats, tasks (via CLI), systemctl, /proc/stat, thermal sensors, and rate-limits cache — with 10s TTL for vitals/services. CPU snapshot updated via setInterval every 10s.

**Tech Stack:** Express.js (ESM), Node.js fs/child_process, existing task-store.js and status-synthesizer.js CLIs.

---

### Task 1: Server-side TTL Cache Utility

**Files:**
- Create: `server/lib/cache.js`

**Implementation:** Simple TTL Map wrapper — `get(key)`, `set(key, data, ttlMs)`, `has(key)`.

---

### Task 2: Rate-Limits API (`GET /api/rate-limits`)

**Files:**
- Create: `server/api/rate-limits.js`

**Implementation:** Read `~/clawd/runtime/rate-limit-cache.json`. If missing → `{ cached: false, stale: true, profiles: [] }`. If file >5min old → add `stale: true` flag. Otherwise return profiles array.

---

### Task 3: Rate-Limits Profile Switch (`POST /api/rate-limits/switch`)

**Files:**
- Modify: `server/api/rate-limits.js`

**Implementation:** Accept `{ to: "yura" | "dima" }`, write to `~/clawd/runtime/active-profile.json`, return `{ ok: true, active: "<name>" }`.

---

### Task 4: CPU Snapshot Background Worker

**Files:**
- Create: `server/lib/vitals.js`

**Implementation:** Read `/proc/stat` twice (10s apart via setInterval) to compute CPU percent. Read thermal zones for cpu_temp. Export `getVitals()` returning cached snapshot.

---

### Task 5: Status Aggregator (`GET /api/status`)

**Files:**
- Modify: `server/index.js`

**Implementation:** Aggregate 12 fields: `gateway_up`, `agents_alive`, `agents_total`, `active_tasks`, `blocked_tasks`, `stuck_tasks`, `failed_tasks`, `failed_services`, `cpu_percent`, `cpu_temp`, `claude_usage_percent`, `codex_usage_percent`. Use TTL cache for services (10s). Heartbeats and tasks read live (fast file reads). Call task-store.js/status-synthesizer.js CLIs for task counts.

---

### Task 6: Wire Routes in server/index.js

**Files:**
- Modify: `server/index.js`

**Implementation:** Import rate-limits router, mount at `/api/rate-limits`. Add `/api/status` handler. Start CPU snapshot interval on server boot.

---

### Task 7: Frontend — TopBar.tsx and UsageTracker.tsx

**Files:**
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/system/UsageTracker.tsx`

**Implementation:** Minimal components that fetch from `/api/status` and `/api/rate-limits` respectively, rendering real data (claude_usage_percent, profiles). These are stubs confirming data flow — full styling depends on #1/#4.

---

### Task 8: Verification

**Steps:**
1. `curl http://localhost:3333/api/status | jq 'keys | length'` → 12
2. `curl http://localhost:3333/api/rate-limits` → array or `{cached:false}`
3. `curl -X POST .../api/rate-limits/switch -d '{"to":"dima"}'` → `{ok:true}`
4. `cat ~/clawd/runtime/active-profile.json` → valid JSON
5. `time curl http://localhost:3333/api/status` → <0.3s
