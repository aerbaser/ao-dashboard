import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Task, PipelineState, StateGroup } from '../lib/types';
import {
  ERROR_STATES,
  TERMINAL_STATES,
  ACTIVE_STATES,
  VALID_ROUTES,
  VALID_OUTCOME_TYPES,
} from '../lib/types';
import { fetchTasks, createTask, fetchCurrentAgent } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { KanbanBoard } from '../components/pipeline/KanbanBoard';
import { TaskDetail } from '../components/pipeline/TaskDetail';
import { MultiSelect } from '../components/ui/MultiSelect';
import { QuickSearch } from '../components/pipeline/QuickSearch';

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

// ─── Presets & localStorage ──────────────────────────────────────────────────

interface Filters {
  owners: string[];
  route: string;
  stateGroup: StateGroup;
}

type PresetId = 'active' | 'mine' | 'blocked' | 'all';

interface PresetDef {
  id: PresetId;
  label: string;
  getFilters: (currentAgent: string | null) => Filters;
}

const PRESETS: PresetDef[] = [
  { id: 'active',  label: 'Active',  getFilters: () => ({ stateGroup: 'active', owners: [], route: '' }) },
  { id: 'mine',    label: 'Mine',    getFilters: (agent) => ({ stateGroup: 'active', owners: agent ? [agent] : [], route: '' }) },
  { id: 'blocked', label: 'Blocked', getFilters: () => ({ stateGroup: 'error', owners: [], route: '' }) },
  { id: 'all',     label: 'All',     getFilters: () => ({ stateGroup: 'all', owners: [], route: '' }) },
];

const STORAGE_KEY = 'pipeline-filter-state';

interface StoredFilterState {
  preset: PresetId | null;
  filters: Filters;
}

function loadFilterState(): StoredFilterState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveFilterState(state: StoredFilterState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ─── Preset Bar ─────────────────────────────────────────────────────────────

function PresetBar({
  activePreset,
  onPresetClick,
}: {
  activePreset: PresetId | null;
  onPresetClick: (id: PresetId) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-1 bg-bg-surface">
      {activePreset === null && (
        <span className="text-xs text-text-disabled font-mono mr-1">custom</span>
      )}
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => onPresetClick(p.id)}
          className={`px-3 py-1 rounded-sm text-sm font-medium transition-colors ${
            activePreset === p.id
              ? 'bg-amber text-text-inverse'
              : 'bg-bg-void text-text-secondary border border-border-subtle hover:border-border-default hover:text-text-primary'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  filters,
  onChange,
  allOwners,
  hideEmpty,
  onHideEmptyChange,
  onCreateClick,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  allOwners: string[];
  hideEmpty: boolean;
  onHideEmptyChange: (v: boolean) => void;
  onCreateClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-bg-surface border-b border-border-subtle flex-wrap">
      {/* Owner multi-select */}
      <MultiSelect
        options={allOwners}
        value={filters.owners}
        onChange={(owners) => onChange({ ...filters, owners })}
        placeholder="All owners"
      />

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

      {/* Hide empty toggle */}
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hideEmpty}
          onChange={(e) => onHideEmptyChange(e.target.checked)}
          className="accent-amber w-3 h-3"
        />
        <span className="text-xs text-text-tertiary">Hide empty</span>
      </label>

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

export default function Pipeline() {
  const fetchTasksFn = useCallback(() => fetchTasks(), []);
  const { data: tasks, loading, refresh } = usePolling(fetchTasksFn, 5000);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);

  // Load initial filter state from localStorage
  const savedState = useRef(loadFilterState());
  const [filters, setFilters] = useState<Filters>(
    savedState.current?.filters ?? { owners: [], route: '', stateGroup: 'active' }
  );
  const [activePreset, setActivePreset] = useState<PresetId | null>(
    savedState.current?.preset ?? null
  );

  const [hideEmpty, setHideEmpty] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Fetch current agent identity on mount
  useEffect(() => {
    fetchCurrentAgent()
      .then((agent) => setCurrentAgent(agent.id))
      .catch(() => { /* not critical */ });
  }, []);

  // Persist filter state to localStorage
  useEffect(() => {
    saveFilterState({ preset: activePreset, filters });
  }, [activePreset, filters]);

  const handlePresetClick = useCallback((id: PresetId) => {
    const preset = PRESETS.find((p) => p.id === id)!;
    const newFilters = preset.getFilters(currentAgent);
    setActivePreset(id);
    setFilters(newFilters);
  }, [currentAgent]);

  const handleFilterChange = useCallback((f: Filters) => {
    setFilters(f);
    setActivePreset(null); // manual change clears active preset
  }, []);

  const allOwners = useMemo(() => {
    if (!tasks) return [];
    return [...new Set(tasks.map((t) => t.owner))].sort();
  }, [tasks]);

  const filteredTasks = useMemo(
    () => filterTasks(tasks || [], filters),
    [tasks, filters]
  );

  // Update freshness timestamp when tasks data changes
  useEffect(() => {
    if (tasks) setLastUpdated(Date.now());
  }, [tasks]);

  // Cmd+K / Ctrl+K to open quick search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearchSelect = useCallback((task: Task) => {
    setShowSearch(false)
    setSelectedTask(task)
  }, [])

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
            {filteredTasks.length !== tasks.length
              ? `${filteredTasks.length} / ${tasks.length} tasks`
              : `${tasks.length} tasks`}
          </span>
        )}
        <Freshness ts={lastUpdated} />
      </header>

      {/* Preset bar */}
      <PresetBar activePreset={activePreset} onPresetClick={handlePresetClick} />

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={handleFilterChange}
        allOwners={allOwners}
        hideEmpty={hideEmpty}
        onHideEmptyChange={setHideEmpty}
        onCreateClick={() => setShowCreate(true)}
      />

      {/* Kanban board */}
      <div className="flex-1 overflow-hidden">
        {tasks && tasks.length > 0 && filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center h-full" data-testid="filtered-empty-state">
            <div className="flex flex-col items-center gap-4 p-8 bg-bg-surface border border-border-subtle rounded-lg text-center max-w-sm animate-fade-in">
              <span className="text-2xl text-text-tertiary">⊘</span>
              <p className="text-sm font-medium text-text-secondary">
                All {tasks.length} tasks are hidden by the current filter
              </p>
              <p className="text-xs font-mono text-text-tertiary">
                0 matching / {tasks.length} total
              </p>
              <button
                onClick={() => handlePresetClick('all')}
                className="mt-1 px-4 py-1.5 text-sm font-semibold rounded-sm bg-amber text-text-inverse hover:brightness-110 transition-all"
              >
                Show all tasks
              </button>
            </div>
          </div>
        ) : (
          <KanbanBoard
            tasks={filteredTasks}
            onCardClick={handleCardClick}
            onRefresh={refresh}
            hideEmpty={hideEmpty}
          />
        )}
      </div>

      {/* Task detail slide-in */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={handleDetailClose}
          onTransition={handleTransition}
        />
      )}

      {/* Quick search overlay */}
      <QuickSearch
        tasks={tasks || []}
        open={showSearch}
        onSelect={handleSearchSelect}
        onClose={() => setShowSearch(false)}
      />

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
