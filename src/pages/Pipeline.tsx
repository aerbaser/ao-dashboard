import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Task, PipelineState, StateGroup } from '../lib/types';
import {
  ERROR_STATES,
  TERMINAL_STATES,
  ACTIVE_STATES,
  VALID_ROUTES,
  VALID_OUTCOME_TYPES,
} from '../lib/types';
import { fetchTasks, createTask } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { KanbanBoard } from '../components/pipeline/KanbanBoard';
import { TaskDetail } from '../components/pipeline/TaskDetail';

// ─── Freshness Indicator ──────────────────────────────────────────────────────

function Freshness({ ts }: { ts: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const seconds = Math.max(0, Math.floor((now - ts) / 1000))
  const label = seconds < 5 ? 'just now' : seconds < 60 ? `${seconds}s ago` : `${Math.floor(seconds / 60)}m ago`
  return <span className="ml-3 text-[11px] font-mono text-text-disabled">Updated {label}</span>
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface Filters {
  owners: string[];
  route: string;
  stateGroup: StateGroup;
}

function FilterBar({
  filters,
  onChange,
  allOwners,
  onCreateClick,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  allOwners: string[];
  onCreateClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-bg-surface border-b border-border-subtle flex-wrap">
      {/* Owner multi-select (simplified as select) */}
      <select
        value={filters.owners[0] || ''}
        onChange={(e) =>
          onChange({ ...filters, owners: e.target.value ? [e.target.value] : [] })
        }
        className="bg-bg-void border border-border-default rounded-sm px-2 py-1.5 text-sm font-mono text-text-primary focus:border-amber focus:outline-none"
      >
        <option value="">All owners</option>
        {allOwners.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>

      {/* Route filter */}
      <select
        value={filters.route}
        onChange={(e) => onChange({ ...filters, route: e.target.value })}
        className="bg-bg-void border border-border-default rounded-sm px-2 py-1.5 text-sm font-mono text-text-primary focus:border-amber focus:outline-none"
      >
        <option value="">All routes</option>
        {VALID_ROUTES.map((r) => (
          <option key={r} value={r}>{r.replace('_route', '')}</option>
        ))}
      </select>

      {/* State group */}
      <select
        value={filters.stateGroup}
        onChange={(e) =>
          onChange({ ...filters, stateGroup: e.target.value as StateGroup })
        }
        className="bg-bg-void border border-border-default rounded-sm px-2 py-1.5 text-sm font-mono text-text-primary focus:border-amber focus:outline-none"
      >
        <option value="all">All states</option>
        <option value="active">Active</option>
        <option value="terminal">Terminal</option>
        <option value="error">Error</option>
      </select>

      <div className="ml-auto">
        <button
          onClick={onCreateClick}
          className="px-3 py-1.5 rounded-sm bg-amber text-text-inverse font-semibold text-sm hover:brightness-110 transition-all"
        >
          + Create Task
        </button>
      </div>
    </div>
  );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

function CreateTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [route, setRoute] = useState<string>('build_route');
  const [outcomeType, setOutcomeType] = useState<string>('app_release');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTask({ title: title.trim(), route, outcome_type: outcomeType });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Failed to create task';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[400px] bg-bg-elevated border border-border-subtle rounded-lg shadow-panel animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-border-subtle">
          <h2 className="text-lg font-semibold text-text-primary">Create Task</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-2 rounded-md bg-red-subtle border border-red text-red text-xs font-mono">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-text-secondary mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-bg-void border border-border-default rounded-sm px-3 py-2 text-sm font-mono text-text-primary focus:border-amber focus:outline-none"
              placeholder="Task title..."
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">Route</label>
            <select
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="w-full bg-bg-void border border-border-default rounded-sm px-2 py-2 text-sm font-mono text-text-primary focus:border-amber focus:outline-none"
            >
              {VALID_ROUTES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-1">Outcome Type</label>
            <select
              value={outcomeType}
              onChange={(e) => setOutcomeType(e.target.value)}
              className="w-full bg-bg-void border border-border-default rounded-sm px-2 py-2 text-sm font-mono text-text-primary focus:border-amber focus:outline-none"
            >
              {VALID_OUTCOME_TYPES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-sm border border-border-subtle text-text-secondary text-sm hover:bg-bg-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="px-4 py-1.5 rounded-sm bg-amber text-text-inverse font-semibold text-sm disabled:opacity-40 hover:brightness-110 transition-all"
            >
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ─── Pipeline Page ────────────────────────────────────────────────────────────

function filterTasks(tasks: Task[], filters: Filters): Task[] {
  return tasks.filter((t) => {
    if (filters.owners.length > 0 && !filters.owners.includes(t.owner)) return false;
    if (filters.route && t.route !== filters.route) return false;
    if (filters.stateGroup === 'active' && !ACTIVE_STATES.includes(t.state)) return false;
    if (filters.stateGroup === 'terminal' && !TERMINAL_STATES.includes(t.state as PipelineState))
      return false;
    if (filters.stateGroup === 'error' && !ERROR_STATES.includes(t.state as PipelineState))
      return false;
    return true;
  });
}

export function Pipeline() {
  const fetchTasksFn = useCallback(() => fetchTasks(), []);
  const { data: tasks, loading, refresh } = usePolling(fetchTasksFn, 5000);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    owners: [],
    route: '',
    stateGroup: 'all',
  });
  const [hideEmpty, setHideEmpty] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const allOwners = useMemo(() => {
    if (!tasks) return [];
    return [...new Set(tasks.map((t) => t.owner))].sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const result = filterTasks(tasks || [], filters);
    setLastUpdated(Date.now());
    return result;
  }, [tasks, filters]);

  const handleCardClick = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handleDetailClose = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const handleTransition = useCallback(() => {
    setSelectedTask(null);
    refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col h-screen bg-bg-base">
      {/* Top bar */}
      <header className="h-[48px] flex items-center px-4 bg-bg-base border-b border-border-subtle shrink-0">
        <h1 className="text-lg font-semibold text-text-primary">Pipeline</h1>
        {loading && !tasks && (
          <span className="ml-3 text-text-tertiary text-sm">Loading...</span>
        )}
        {tasks && (
          <span className="ml-3 text-text-tertiary font-mono text-xs">
            {tasks.length} tasks
          </span>
        )}
        <Freshness ts={lastUpdated} />
        <label className="ml-auto flex items-center gap-1.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={hideEmpty}
            onChange={(e) => setHideEmpty(e.target.checked)}
            className="accent-amber w-3 h-3"
          />
          <span className="text-xs text-text-tertiary">Hide empty</span>
        </label>
      </header>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        allOwners={allOwners}
        onCreateClick={() => setShowCreate(true)}
      />

      {/* Kanban board */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          tasks={filteredTasks}
          onCardClick={handleCardClick}
          onRefresh={refresh}
          hideEmpty={hideEmpty}
        />
      </div>

      {/* Task detail slide-in */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={handleDetailClose}
          onTransition={handleTransition}
        />
      )}

      {/* Create task modal */}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
