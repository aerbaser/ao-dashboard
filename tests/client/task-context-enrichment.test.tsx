import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Task, TaskContract } from '../../src/lib/types';

// ── dnd-kit mocks (required by TaskCard) ──────────────────────────────────────

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}));

// ── Lazy imports (after mocks) ────────────────────────────────────────────────

import { TaskCard } from '../../src/components/pipeline/TaskCard';
import { OperatorSummary } from '../../src/components/pipeline/OperatorSummary';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test_001',
    state: 'EXECUTION',
    owner: 'archimedes',
    route: 'build_route',
    title: 'Test task',
    age: 30,
    ttl: null,
    blockers: 0,
    retries: 0,
    terminal: false,
    hasQuality: false,
    hasOutcome: false,
    hasRelease: false,
    ...overrides,
  };
}

function makeContract(overrides: Partial<TaskContract> = {}): TaskContract {
  return {
    schema_version: '1.0',
    task_id: 'tsk_test_001',
    title: 'Test task',
    raw_request: 'Build the feature as described',
    outcome_type: 'app_release',
    delivery_mode: 'repo_build',
    route: 'build_route',
    full_solution: true,
    approval_policy: 'delegated_timeout',
    constraints: [],
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

const noop = vi.fn();

// ── OperatorSummary tests ─────────────────────────────────────────────────────

describe('OperatorSummary', () => {
  afterEach(cleanup);

  it('renders ledger task with rich contract fields', () => {
    const task = makeTask({
      source_type: 'ledger',
      goal: 'Ship the dashboard v2',
      next_action: 'Merge PR #42 after CI passes',
    });
    const contract = makeContract({
      success_definition: ['All AC checkboxes green'],
    });

    render(<OperatorSummary task={task} contract={contract} />);

    expect(screen.getByTestId('operator-summary')).toBeTruthy();
    expect(screen.getByText('Ledger task')).toBeTruthy();
    expect(screen.getByText('Ship the dashboard v2')).toBeTruthy();
    expect(screen.getByText('Merge PR #42 after CI passes')).toBeTruthy();
  });

  it('renders GitHub-synthesized task with repo/issue provenance', () => {
    const task = makeTask({
      source_type: 'github',
      source_ref: { repo: 'aerbaser/ao-dashboard', issue_number: 159 },
      goal: 'Enrich task cards',
      next_action: null,
    });

    render(<OperatorSummary task={task} contract={null} />);

    expect(screen.getByText(/aerbaser\/ao-dashboard#159/)).toBeTruthy();
    expect(screen.getByText('Enrich task cards')).toBeTruthy();
    expect(screen.getByTestId('next-action-fallback')).toBeTruthy();
    expect(screen.getByText('No next action recorded')).toBeTruthy();
  });

  it('shows fallback labels when raw_request and goal are missing', () => {
    const task = makeTask({ source_type: 'ledger', goal: null, next_action: null });
    const contract = makeContract({ raw_request: '', success_definition: [] });

    render(<OperatorSummary task={task} contract={contract} />);

    expect(screen.getByTestId('goal-fallback')).toBeTruthy();
    expect(screen.getByText('Not specified')).toBeTruthy();
    expect(screen.getByTestId('next-action-fallback')).toBeTruthy();
  });

  it('falls back to raw_request when success_definition is empty', () => {
    const task = makeTask({ source_type: 'ledger', goal: null, next_action: null });
    const contract = makeContract({
      raw_request: 'Fix the login bug',
      success_definition: [],
    });

    render(<OperatorSummary task={task} contract={contract} />);

    expect(screen.getByText('Fix the login bug')).toBeTruthy();
  });

  it('truncates long text with expand/collapse toggle', () => {
    const longGoal = 'A'.repeat(200);
    const task = makeTask({ goal: longGoal });
    const contract = makeContract();

    render(<OperatorSummary task={task} contract={contract} />);

    // Should show truncated version (120 chars + "...")
    const goalEl = screen.getByTestId('goal-text');
    expect(goalEl.textContent).toContain('...');
    expect(goalEl.textContent).toContain('more');

    // Click expand
    fireEvent.click(screen.getByTestId('goal-text-toggle'));
    expect(goalEl.textContent).toContain(longGoal);
    expect(goalEl.textContent).toContain('less');

    // Click collapse
    fireEvent.click(screen.getByTestId('goal-text-toggle'));
    expect(goalEl.textContent).toContain('...');
  });

  it('renders without crash when contract is null (no events, no decisions)', () => {
    const task = makeTask({ source_type: 'ledger', goal: null, next_action: null });

    render(<OperatorSummary task={task} contract={null} />);

    expect(screen.getByTestId('operator-summary')).toBeTruthy();
    expect(screen.getByText('Not specified')).toBeTruthy();
    expect(screen.getByText('No next action recorded')).toBeTruthy();
  });

  it('shows GitHub source without source_ref gracefully', () => {
    const task = makeTask({ source_type: 'github', goal: 'Do something' });

    render(<OperatorSummary task={task} contract={null} />);

    expect(screen.getByText('GitHub issue')).toBeTruthy();
  });
});

// ── TaskCard context cue tests ────────────────────────────────────────────────

describe('TaskCard context cues', () => {
  afterEach(cleanup);

  it('shows LDG badge for ledger tasks', () => {
    const task = makeTask({ source_type: 'ledger', goal: 'Ship feature' });

    render(<TaskCard task={task} onClick={noop} />);

    expect(screen.getByText('LDG')).toBeTruthy();
    expect(screen.getByText(/Ship feature/)).toBeTruthy();
  });

  it('shows GH badge for GitHub tasks', () => {
    const task = makeTask({ source_type: 'github', goal: 'Fix issue' });

    render(<TaskCard task={task} onClick={noop} />);

    expect(screen.getByText('GH')).toBeTruthy();
  });

  it('shows next_action when goal is missing', () => {
    const task = makeTask({ goal: null, next_action: 'Review PR #10' });

    render(<TaskCard task={task} onClick={noop} />);

    expect(screen.getByText(/Review PR #10/)).toBeTruthy();
  });

  it('truncates long goal text at 60 chars on card', () => {
    const longGoal = 'B'.repeat(80);
    const task = makeTask({ goal: longGoal });

    render(<TaskCard task={task} onClick={noop} />);

    const snippetEl = screen.getByText(/B{10,}\.{3}/);
    expect(snippetEl).toBeTruthy();
  });

  it('does not show snippet when both goal and next_action are missing', () => {
    const task = makeTask({ goal: null, next_action: null });

    const { container } = render(<TaskCard task={task} onClick={noop} />);

    // Should still show the source badge
    expect(screen.getByText('LDG')).toBeTruthy();
    // No snippet text beyond the badge
    const contextRow = container.querySelectorAll('.truncate');
    // Title has truncate too, so just confirm no extra snippet content
    const snippets = Array.from(contextRow).filter(
      (el) => el.textContent && el.textContent.length > 0 && !el.textContent.includes('Test task')
    );
    expect(snippets.length).toBe(0);
  });
});
