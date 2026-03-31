import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Task } from '../../src/lib/types';

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

import { TaskCard } from '../../src/components/pipeline/TaskCard';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_age_test',
    state: 'EXECUTION',
    owner: 'archimedes',
    route: 'build_route',
    title: 'Age badge test',
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

describe('TaskCard age badge color', () => {
  afterEach(cleanup);
  const noop = vi.fn();

  it('shows green (emerald) text for fresh EXECUTION task', () => {
    render(<TaskCard task={makeTask({ age: 60 })} onClick={noop} />);
    const ageBadge = screen.getByText('1h');
    expect(ageBadge.className).toContain('text-emerald');
  });

  it('shows amber text for EXECUTION task at 120m', () => {
    render(<TaskCard task={makeTask({ age: 120 })} onClick={noop} />);
    const ageBadge = screen.getByText('2h');
    expect(ageBadge.className).toContain('text-amber');
  });

  it('shows red text for EXECUTION task at 480m', () => {
    render(<TaskCard task={makeTask({ age: 480 })} onClick={noop} />);
    const ageBadge = screen.getByText('8h');
    expect(ageBadge.className).toContain('text-red');
  });

  it('shows tooltip on red age badge', () => {
    render(<TaskCard task={makeTask({ age: 480 })} onClick={noop} />);
    const ageBadge = screen.getByText('8h');
    expect(ageBadge.title).toContain('consider intervening');
    expect(ageBadge.title).toContain('EXECUTION');
  });

  it('does not show tooltip on green/amber age badge', () => {
    render(<TaskCard task={makeTask({ age: 60 })} onClick={noop} />);
    const ageBadge = screen.getByText('1h');
    expect(ageBadge.title).toBe('');
  });

  it('shows neutral (tertiary) text when age is null', () => {
    render(<TaskCard task={makeTask({ age: null })} onClick={noop} />);
    const ageBadge = screen.getByText('—');
    expect(ageBadge.className).toContain('text-text-tertiary');
  });

  it('uses REVIEW_PENDING thresholds — amber at 60m', () => {
    render(<TaskCard task={makeTask({ state: 'REVIEW_PENDING', age: 60 })} onClick={noop} />);
    const ageBadge = screen.getByText('1h');
    expect(ageBadge.className).toContain('text-amber');
  });

  it('uses CONTEXT thresholds — green at 200m', () => {
    render(<TaskCard task={makeTask({ state: 'CONTEXT', age: 200 })} onClick={noop} />);
    const ageBadge = screen.getByText('3h');
    expect(ageBadge.className).toContain('text-emerald');
  });

  it('does not conflict with AWAITING_OWNER urgency styling', () => {
    render(<TaskCard task={makeTask({ state: 'AWAITING_OWNER', age: 300 })} onClick={noop} />);
    const ageBadge = screen.getByText('5h');
    // AWAITING_OWNER with 300m uses default thresholds: amber at 180
    expect(ageBadge.className).toContain('text-amber');
  });
});
