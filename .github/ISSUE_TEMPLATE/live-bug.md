---
name: Live Bug / Dashboard / UI / API Issue
about: Use this template for any issue where the failure is visible in the live product
title: "bug(PX): <page/area> — <exact visible failure>"
labels: ["bug", "area:frontend"]
---

## Problem

**What is broken for the user?**
<!-- Exact visible failure mode — what the user sees -->

**Where does it happen?**
<!-- Page URL(s), route(s), component(s) -->

## Expected vs Actual

- **Expected:**
- **Actual:**

## Reproduction

1. 
2. 
3. 

## Affected Pages

<!-- List every page/route affected -->
- 

## Affected Endpoints / Contracts

<!-- List every backend endpoint that the affected pages depend on -->
- 

## Risky / Legacy States (must be checked before close)

- [ ] Legacy enum/status values (e.g. removed states still in persisted data)
- [ ] Empty state (zero records returned)
- [ ] All-done / all-terminal state (records exist but none are active)
- [ ] Missing / partial / null fields
- [ ] id / slug / service-name mismatch between list and detail endpoints
- [ ] Runtime exception / blank screen / uncaught console error

## Acceptance Criteria

- [ ] Root cause addressed, not only symptom patched
- [ ] All affected pages render without blank screen or runtime exception
- [ ] All affected endpoints return expected shape (no unexpected 404/500)
- [ ] Risky/legacy states listed above are verified against live data
- [ ] Unit or integration tests added for the confirmed failure mode
- [ ] Proof block attached after merge (see below)

## Required Proof Block (mandatory after merge)

> CI green + PR merged is NOT done. Attach this block when marking the issue resolved.

```md
Proof:
- Live URL / surface: ...
- Pages checked: ...
- API checks: ...
- Data states checked:
  - legacy/edge values: ...
  - empty state: ...
  - normal state: ...
- Console/runtime result: no uncaught errors / [exceptions found]
- Result: PASS / FAIL
- Evidence: screenshot / endpoint output / browser note / log
```

## Notes for Builder

- CI green is necessary but not sufficient for this class of issue
- "PR merged" is not a completion signal — live acceptance is required
- If you discover additional failure modes during investigation, open a child issue rather than expanding scope
