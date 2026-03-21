# System Page Design

## Scope

Implement issue `#7` only: the System page and its supporting APIs. This PR will not change the broader app shell, routing structure, or unrelated pages.

## Goals

- Render a four-section System page with `ServicesGrid`, `CronCalendar`, `ServerVitals`, and `UsageTracker`.
- Back those components with live server APIs for services, cron, vitals, and rate-limit data.
- Enforce forbidden-service checks on the server, not only in the UI.
- Keep all styling within the existing design-token palette and typography.

## Backend Design

### Services API

- Add `server/api/services.js`.
- Define a `SERVICE_META` map for the required Core / Agents / Integrations groups.
- `GET /api/services` will read `systemctl --user show` data for the known units, attach display metadata, and re-read `~/clawd/memory/forbidden-services.json` on every request.
- `POST /api/services/:name/:action` will accept `start`, `stop`, and `restart` only.
- The POST handler will re-check the forbidden list on every call and return HTTP `403` for blocked units.
- The action handler will use `execFile('systemctl', ['--user', action, unit])` and append a line to an audit log under `~/clawd/runtime/dashboard-audit.log`.

### Cron API

- Add `server/api/cron.js`.
- `GET /api/cron` will parse `crontab -l` into structured entries preserving comments and enabled/disabled state.
- `POST /api/cron` will validate every 5-field cron expression, rebuild the crontab content, and write it through `crontab -` using stdin piping instead of a shell string.
- The API will reject invalid schedules with HTTP `400`.

### Vitals API

- Add `server/api/vitals.js` and expand `server/lib/vitals.js`.
- CPU usage will come from two `/proc/stat` samples roughly 200ms apart so `per_core` reflects deltas instead of a single zero snapshot.
- Temperature will read all `/sys/class/thermal/*/temp` values and use the highest valid reading.
- RAM will combine `/proc/meminfo` totals with a top-process snapshot from `ps`.
- Disk will combine `df -BM` totals with direct size sampling for key directories.
- Load average will come from `/proc/loadavg`.
- Tailscale IP will come from `tailscale ip -4`, returning `null` when unavailable.

### Rate-Limits API

- Extend `server/api/rate-limits.js`.
- Normalize cache-file profiles into the three display rows required by the UI.
- Add `POST /api/rate-limits/switch` support for a visible profile switch action while keeping the current file-based persistence.

## Frontend Design

### System Page Layout

- Build `src/pages/SystemPage.tsx` as a two-column responsive dashboard using the existing panel language.
- Place Services and Cron in the left column, Vitals and Usage in the right column on wide screens, with a single-column stack on smaller widths.

### ServicesGrid

- Use the server-provided service list and group by `group`.
- Each tile shows name, status badge, uptime, memory, and forbidden state.
- Forbidden tiles are visually dimmed, show a `🚫` badge, and disable action buttons.
- Restart and stop actions will require a confirm dialog before POSTing.

### CronCalendar

- Render a weekly 7x24 grid with one hour rows.
- Map parsed cron entries into positioned blocks repeated across matching weekdays.
- Clicking a block opens an inline editor for schedule, label, enabled state, and delete.
- Dragging a block vertically/horizontally updates minute, hour, and weekday fields, then persists through `POST /api/cron`.

### ServerVitals

- Show a 4x4 CPU heatmap, temperature badge, load averages, Tailscale IP, RAM bar with top processes, and disk bar with key directories.
- Use token-based green/amber/red state styling rather than hardcoded colors.

### UsageTracker

- Poll the rate-limit API and display three profile rows.
- Each row shows token and request usage, progress bars, and a live reset countdown derived from `reset_at`.
- The switch button will call `POST /api/rate-limits/switch` and refresh data.

## Testing Strategy

- Add a lightweight Vitest setup for TypeScript and React component/helper tests.
- Add server route tests for forbidden services, cron validation, vitals shaping, and rate-limit normalization.
- Add component tests for `ServicesGrid`, `ServerVitals`, and `UsageTracker` helper-driven rendering where it adds confidence without overfitting layout details.

## Risks And Limits

- Service actions and crontab writes depend on the local user environment; tests will mock child-process boundaries.
- Cron drag-editing will target hour-slot movement, not arbitrary minute dragging, to keep the interaction predictable.
- The current forbidden-services file does not include `openclaw-gateway`, so the implementation will treat the issue requirement as a required compatibility rule and include that unit in the effective forbidden set unless the file is updated later.
