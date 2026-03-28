# ModelSelector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a ModelSelector component with type-to-confirm destructive dialog for changing an agent's model, triggering a gateway restart.

**Architecture:** New `ConfirmDialog` reusable UI component + `ModelSelector` agent component + backend POST endpoint. The confirmation dialog requires typing the agent name before the confirm button enables. On confirm, POST to backend which updates openclaw.json and restarts the gateway, then poll `/api/status` until healthy.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS with design tokens, Express.js backend, Vitest + Testing Library

---

### Task 1: Create ConfirmDialog reusable component

**Files:**
- Create: `src/components/ui/ConfirmDialog.tsx`

**Step 1: Write the failing test**

Create `tests/client/confirm-dialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ConfirmDialog from '../../src/components/ui/ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    title: 'Confirm Action',
    message: 'Are you sure?',
    confirmLabel: 'Confirm',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  }

  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument()
  })

  it('calls onCancel when Cancel clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })

  it('confirm button enabled when no confirmText required', () => {
    render(<ConfirmDialog {...defaultProps} />)
    const btn = screen.getByText('Confirm')
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    expect(defaultProps.onConfirm).toHaveBeenCalled()
  })

  it('confirm button disabled until confirmText matches', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog {...defaultProps} onConfirm={onConfirm} confirmText="archimedes" />
    )
    const btn = screen.getByRole('button', { name: /confirm/i })
    expect(btn).toBeDisabled()

    const input = screen.getByPlaceholderText('archimedes')
    fireEvent.change(input, { target: { value: 'archimed' } })
    expect(btn).toBeDisabled()

    fireEvent.change(input, { target: { value: 'archimedes' } })
    expect(btn).not.toBeDisabled()

    fireEvent.click(btn)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when backdrop clicked', () => {
    render(<ConfirmDialog {...defaultProps} />)
    fireEvent.click(screen.getByTestId('confirm-dialog-backdrop'))
    expect(defaultProps.onCancel).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/confirm-dialog.test.tsx`
Expected: FAIL — module not found

**Step 3: Write the ConfirmDialog component**

Create `src/components/ui/ConfirmDialog.tsx`:

```tsx
import { useState, useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  confirmText?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmText,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    if (!open) setInputValue('')
  }, [open])

  if (!open) return null

  const confirmed = confirmText ? inputValue === confirmText : true
  const btnColor = variant === 'danger'
    ? 'bg-red text-white'
    : 'bg-accent-amber text-text-inverse'

  return (
    <>
      <div
        data-testid="confirm-dialog-backdrop"
        className="fixed inset-0 bg-black/70 backdrop-blur-[2px] z-50"
        onClick={onCancel}
      />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[460px] max-w-[calc(100vw-2rem)] bg-bg-surface border border-border-default rounded-lg overflow-hidden animate-fade-in">
        <div className="flex items-center gap-2.5 px-6 pt-5">
          <div className="w-9 h-9 rounded-full bg-accent-amber-subtle flex items-center justify-center text-base shrink-0">
            ⚠
          </div>
          <h2 className="text-[15px] font-semibold text-text-primary">{title}</h2>
        </div>

        <div className="px-6 py-4">
          <div className="text-[12px] text-text-secondary leading-relaxed">
            {message}
          </div>

          {confirmText && (
            <div className="mt-4">
              <label className="block text-[12px] text-text-secondary mb-1.5">
                Type <code className="font-mono text-text-primary bg-bg-overlay px-1 rounded text-[11px]">{confirmText}</code> to confirm:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder={confirmText}
                className="w-full px-3 py-2 bg-bg-elevated border border-border-default rounded font-mono text-[13px] text-text-primary placeholder:text-text-disabled outline-none focus:border-accent-amber"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-[7px] rounded text-[12px] font-medium text-text-secondary border border-border-default hover:bg-bg-hover transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!confirmed}
            className={`px-4 py-[7px] rounded text-[12px] font-semibold transition-colors ${btnColor} ${confirmed ? '' : 'opacity-50 cursor-not-allowed'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/client/confirm-dialog.test.tsx`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add src/components/ui/ConfirmDialog.tsx tests/client/confirm-dialog.test.tsx
git commit -m "feat(#74): add ConfirmDialog reusable component with type-to-confirm"
```

---

### Task 2: Add backend POST /api/agents/:id/model endpoint

**Files:**
- Modify: `server/api/agents.js` (add route at bottom, before `export default router`)
- Create: `tests/server/agent-model.test.ts`

**Step 1: Write the failing test**

Create `tests/server/agent-model.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fs, child_process before importing
vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue('{}'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn(),
  rename: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}))

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd, _args, _opts, cb) => cb(null, 'ok', '')),
}))

import express from 'express'
import request from 'supertest'

describe('POST /api/agents/:id/model', () => {
  let app: express.Express

  beforeEach(async () => {
    vi.resetModules()
    const { readFile } = await import('fs/promises')
    const mocked = vi.mocked(readFile)
    mocked.mockResolvedValue(JSON.stringify({
      agents: {
        archimedes: { model: 'claude-opus-4-6', provider: 'anthropic' },
        sokrat: { model: 'claude-opus-4-6', provider: 'anthropic' },
      }
    }))

    app = express()
    app.use(express.json())
    const { default: agentsRouter } = await import('../../server/api/agents.js')
    app.use('/api/agents', agentsRouter)
  })

  it('returns 400 for missing model field', async () => {
    const res = await request(app)
      .post('/api/agents/archimedes/model')
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown agent', async () => {
    const res = await request(app)
      .post('/api/agents/unknown-agent/model')
      .send({ model: 'claude-sonnet-4-6' })
    expect(res.status).toBe(404)
  })

  it('returns 200 with restarting:true on valid request', async () => {
    const res = await request(app)
      .post('/api/agents/archimedes/model')
      .send({ model: 'claude-sonnet-4-6' })
    expect(res.status).toBe(200)
    expect(res.body.restarting).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/agent-model.test.ts`
Expected: FAIL — route not found, 404 for all

**Step 3: Write the backend endpoint**

Add to `server/api/agents.js` before `export default router`:

```js
const OPENCLAW_CONFIG = join(HOME, '.openclaw/openclaw.json')

// POST /api/agents/:id/model — change agent model + restart gateway
router.post('/:id/model', async (req, res) => {
  const { id } = req.params
  const { model } = req.body

  if (!model || typeof model !== 'string') {
    return res.status(400).json({ ok: false, error: 'model is required' })
  }

  const agent = AGENT_META.find(a => a.id === id)
  if (!agent) {
    return res.status(404).json({ ok: false, error: `Unknown agent: ${id}` })
  }

  try {
    // Read current config
    const raw = await readFile(OPENCLAW_CONFIG, 'utf-8')
    const config = JSON.parse(raw)

    if (!config.agents?.[id]) {
      return res.status(404).json({ ok: false, error: `Agent ${id} not found in openclaw.json` })
    }

    // Backup before write
    await copyFile(OPENCLAW_CONFIG, `${OPENCLAW_CONFIG}.bak`)

    // Update model
    config.agents[id].model = model
    await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2), 'utf-8')

    // Trigger gateway restart (fire and forget)
    execFile('openclaw', ['gateway', 'restart'], { timeout: 60000 }, (err) => {
      if (err) console.error('[agents] gateway restart failed:', err.message)
    })

    res.json({ ok: true, restarting: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})
```

Also add `writeFile, copyFile` to the fs/promises import at top of agents.js.

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/agent-model.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/api/agents.js tests/server/agent-model.test.ts
git commit -m "feat(#74): add POST /api/agents/:id/model backend endpoint"
```

---

### Task 3: Add API client functions for model change + available models

**Files:**
- Modify: `src/lib/api.ts` (add functions at bottom of Agents section)

**Step 1: Add the API functions**

Add to `src/lib/api.ts` after the existing agent functions:

```ts
export async function changeAgentModel(
  agentId: string,
  model: string
): Promise<{ ok: boolean; restarting?: boolean; error?: string }> {
  const res = await fetch(`${BASE}/agents/${agentId}/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model }),
  })
  return res.json()
}
```

**Step 2: Run typecheck**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(#74): add changeAgentModel API client function"
```

---

### Task 4: Create ModelSelector component

**Files:**
- Create: `src/components/agents/ModelSelector.tsx`
- Create: `tests/client/model-selector.test.tsx`

**Step 1: Write the failing test**

Create `tests/client/model-selector.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  changeAgentModel: vi.fn(),
  getStatus: vi.fn(),
}))

import ModelSelector from '../../src/components/agents/ModelSelector'
import { changeAgentModel, getStatus } from '../../src/lib/api'
import type { AgentInfo } from '../../src/lib/api'

const mockAgent: AgentInfo = {
  id: 'archimedes',
  name: 'Архимед',
  emoji: '🔧',
  role: 'Engineer',
  status: 'active',
  current_task_id: null,
  current_step: null,
  progress_note: null,
  checkpoint_safe: null,
  last_seen: null,
  session_key: null,
  workspace_path: null,
  topic_id: null,
  heartbeat_raw: null,
  mailbox: { inbox: 0, processing: 0, done: 0, deadletter: 0 },
}

describe('ModelSelector', () => {
  const onToast = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows current model as badge', () => {
    render(
      <ModelSelector
        agent={mockAgent}
        currentModel="claude-opus-4-6"
        onToast={onToast}
      />
    )
    expect(screen.getByText('claude-opus-4-6')).toBeInTheDocument()
  })

  it('shows dropdown with available models', () => {
    render(
      <ModelSelector
        agent={mockAgent}
        currentModel="claude-opus-4-6"
        onToast={onToast}
      />
    )
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
  })

  it('shows warning card when new model selected', () => {
    render(
      <ModelSelector
        agent={mockAgent}
        currentModel="claude-opus-4-6"
        onToast={onToast}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    expect(screen.getByText(/Gateway Restart Required/)).toBeInTheDocument()
  })

  it('type-to-confirm blocks until name matches', () => {
    render(
      <ModelSelector
        agent={mockAgent}
        currentModel="claude-opus-4-6"
        onToast={onToast}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    const confirmBtn = screen.getByRole('button', { name: /confirm change/i })
    expect(confirmBtn).toBeDisabled()
  })

  it('POST triggers model update on confirm', async () => {
    vi.mocked(changeAgentModel).mockResolvedValue({ ok: true, restarting: true })
    vi.mocked(getStatus).mockResolvedValue({
      gateway_up: true, agents_alive: 1, agents_total: 1,
      active_tasks: 0, blocked_tasks: 0, stuck_tasks: 0,
      failed_services: 0, cpu_percent: 0, cpu_temp: 0,
      claude_usage_percent: 0, codex_usage_percent: 0, timestamp: '',
    })

    render(
      <ModelSelector
        agent={mockAgent}
        currentModel="claude-opus-4-6"
        onToast={onToast}
      />
    )
    // Select new model
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    // Type agent id to confirm
    const input = screen.getByPlaceholderText('archimedes')
    fireEvent.change(input, { target: { value: 'archimedes' } })
    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: /confirm change/i })
    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    expect(changeAgentModel).toHaveBeenCalledWith('archimedes', 'claude-sonnet-4-6')
    expect(onToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'warning' })
    )
  })

  it('cancel dismisses without changes', () => {
    render(
      <ModelSelector
        agent={mockAgent}
        currentModel="claude-opus-4-6"
        onToast={onToast}
      />
    )
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'claude-sonnet-4-6' },
    })
    expect(screen.getByText(/Gateway Restart Required/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText(/Gateway Restart Required/)).not.toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/client/model-selector.test.tsx`
Expected: FAIL — module not found

**Step 3: Write ModelSelector component**

Create `src/components/agents/ModelSelector.tsx` — see issue spec for full behavior:
- Current model badge colored by provider (anthropic=indigo, openai-codex=emerald, google=blue)
- Model dropdown with available models
- On selection: inline warning card with type-to-confirm
- On confirm: POST + toast + poll status
- On cancel: dismiss

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/client/model-selector.test.tsx`
Expected: PASS (all 6 tests)

**Step 5: Run full test suite + lint + typecheck**

```bash
npx vitest run && npm run lint && npm run typecheck
```

**Step 6: Commit**

```bash
git add src/components/agents/ModelSelector.tsx tests/client/model-selector.test.tsx
git commit -m "feat(#74): add ModelSelector component with type-to-confirm"
```

---

### Task 5: Final verification and push

**Step 1: Run full checks**

```bash
npx vitest run && npm run lint && npm run typecheck && npm run typecheck:server
```

**Step 2: Push and create PR**

```bash
git push -u origin feat/issue-74
gh pr create --title "feat(#74): ModelSelector with type-to-confirm model change" \
  --body "## Summary
- ConfirmDialog reusable component with optional type-to-confirm
- ModelSelector component: model badge, dropdown, warning card, confirm flow
- Backend POST /api/agents/:id/model: validates, updates openclaw.json, restarts gateway
- Gateway restart polling with toast feedback

Closes #74

## Test plan
- [ ] ConfirmDialog renders/hides, type-to-confirm blocks until match
- [ ] ModelSelector shows current model, dropdown, warning card on selection
- [ ] Type-to-confirm disables button until agent name matches
- [ ] POST triggers model update on confirm
- [ ] Cancel dismisses without changes
- [ ] Backend validates model, returns 400/404 for bad requests"
```
