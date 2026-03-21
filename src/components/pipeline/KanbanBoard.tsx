import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import type { Task, PipelineState, TransitionError } from '../../lib/types';
import { MAIN_FLOW_STATES, SIDE_STATES } from '../../lib/types';
import { transitionTask } from '../../lib/api';
import { TaskCard } from './TaskCard';

// Pipeline state color map for column headers
const STATE_COLORS: Record<PipelineState, string> = {
  INTAKE: '#60A5FA',
  CONTEXT: '#818CF8',
  RESEARCH: '#A78BFA',
  DESIGN: '#F472B6',
  PLANNING: '#FB923C',
  SETUP: '#FBBF24',
  EXECUTION: '#F5A623',
  REVIEW_PENDING: '#34D399',
  CI_PENDING: '#22C55E',
  QUALITY_GATE: '#10B981',
  FINALIZING: '#6EE7B7',
  DEPLOYING: '#A7F3D0',
  OBSERVING: '#D1FAE5',
  DONE: '#4ADE80',
  BLOCKED: '#EF4444',
  FAILED: '#DC2626',
  WAITING_USER: '#FBBF24',
  STUCK: '#F97316',
};

interface KanbanColumnProps {
  state: PipelineState;
  tasks: Task[];
  onCardClick: (task: Task) => void;
  errors: Record<string, TransitionError>;
}

function KanbanColumn({ state, tasks, onCardClick, errors }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: state });
  const color = STATE_COLORS[state];

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-shrink-0 w-[260px] flex flex-col rounded-lg
        ${isOver ? 'bg-bg-overlay' : 'bg-bg-void'}
        transition-colors duration-100
      `}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-sm font-medium text-text-primary truncate">
          {state.replace(/_/g, ' ')}
        </span>
        <span
          className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-sm font-mono text-xs"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onCardClick}
              error={errors[task.id] || null}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

interface KanbanBoardProps {
  tasks: Task[];
  onCardClick: (task: Task) => void;
  onRefresh: () => void;
}

export function KanbanBoard({ tasks, onCardClick, onRefresh }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, TransitionError>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const tasksByState = useCallback(
    (state: PipelineState) => tasks.filter((t) => t.state === state),
    [tasks]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const task = tasks.find((t) => t.id === event.active.id);
      setActiveTask(task || null);
    },
    [tasks]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = active.id as string;
      const targetState = over.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.state === targetState) return;

      // Show transition toast
      const label = targetState.replace(/_/g, ' ');
      setToast(`Transitioning → ${label}...`);

      try {
        const result = await transitionTask(taskId, targetState);
        if ('error' in result) {
          // Guard violation: show inline error on card
          setErrors((prev) => ({ ...prev, [taskId]: result as TransitionError }));
          setToast(null);
        } else {
          // Clear any previous error for this task
          setErrors((prev) => {
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
          setToast(null);
          onRefresh();
        }
      } catch (e: unknown) {
        const err = e as TransitionError;
        if (err.error === 'GUARD_VIOLATION') {
          setErrors((prev) => ({ ...prev, [taskId]: err }));
        }
        setToast(null);
      }
    },
    [tasks, onRefresh]
  );

  const allStates: PipelineState[] = [...MAIN_FLOW_STATES, ...SIDE_STATES];

  return (
    <div className="relative h-full">
      {/* Toast */}
      {toast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-md bg-amber text-text-inverse text-sm font-semibold shadow-md animate-fade-in">
          {toast}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 h-full overflow-x-auto pb-3 px-1">
          {allStates.map((state) => (
            <KanbanColumn
              key={state}
              state={state}
              tasks={tasksByState(state)}
              onCardClick={onCardClick}
              errors={errors}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-[240px] opacity-80 rotate-2">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
