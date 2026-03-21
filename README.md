# ao-dashboard

AO v8.2 Pipeline Control Dashboard.

**Stack:** React + Vite + TypeScript + Tailwind · Express backend (`:3333`)  
**Auth:** Tailscale only  
**Design:** Tokens from Leo at `~/.openclaw/workspace-leo/projects/ao-dashboard/design-tokens.json`  
**Spec:** `~/clawd/tasks/tsk_20260320_e717ef/outputs/ao-dashboard-spec.md`

## Dev

```bash
npm ci
npm run dev       # vite :5173 + express :3333
```

## Build

```bash
npm run build
npm start
```

## Agents

| Role | Scope |
|------|-------|
| **Архимед** | Application implementation (src/, server/api/) |
| **Лео** | Design tokens → tailwind.config.js + src/index.css |
| **Гефест** | Infra: systemd service, CI/CD, AO registration |
