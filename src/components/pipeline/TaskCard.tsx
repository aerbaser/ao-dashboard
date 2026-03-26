import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TransitionError } from '../../lib/types';
import CopyButton from '../ui/CopyButton';

function timeAgo(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
}

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
  error?: TransitionError | null;
}

export function TaskCard({ task, onClick, error }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = task.state === 'EXECUTION' || task.state === 'SETUP';
  const isCritical = task.state === 'BLOCKED' || task.state === 'FAILED';

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={`
          bg-bg-surface border border-border-default rounded-md
          p-3 cursor-pointer min-h-[88px]
          hover:bg-bg-elevated transition-colors duration-100
          ${isActive ? 'animate-pulse-active' : ''}
          ${isCritical ? 'animate-pulse-critical' : ''}
        `}
        onClick={() => onClick(task)}
      >
        {/* Title */}
        <p className="text-text-primary text-sm font-medium leading-tight truncate">
          {task.title || 'Untitled'}
        </p>

        {/* Task ID */}
        <p className="font-mono text-xs text-text-tertiary mt-1 flex items-center gap-1">
          <span>{task.id}</span>
          <CopyButton text={task.id} />
        </p>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {/* Owner badge */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-bg-elevated text-text-secondary font-mono text-xs">
            {task.owner}
          </span>

          {/* Route badge */}
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-blue-subtle text-blue font-mono text-xs">
            {task.route?.replace('_route', '') ?? '—'}
          </span>

          {/* Age */}
          <span className="font-mono text-xs text-text-tertiary ml-auto">
            {timeAgo(task.age)}
          </span>
        </div>

        {/* Indicators row */}
        <div className="flex items-center gap-2 mt-2">
          {/* Blockers */}
          {task.blockers > 0 && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-red-subtle text-red font-mono text-xs">
              {task.blockers} blocker{task.blockers > 1 ? 's' : ''}
            </span>
          )}

          {/* Retries */}
          {task.retries > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-amber-subtle text-amber font-mono text-xs">
              {task.retries}r
            </span>
          )}

          {/* Artifact icons */}
          <div className="flex items-center gap-1 ml-auto">
            {task.hasQuality && (
              <span className="text-xs text-emerald font-mono" title="Quality report">Q</span>
            )}
            {task.hasOutcome && (
              <span className="text-xs text-blue font-mono" title="Outcome manifest">O</span>
            )}
            {task.hasRelease && (
              <span className="text-xs text-amber font-mono" title="Release evidence">R</span>
            )}
          </div>
        </div>
      </div>

      {/* Inline error card for guard violations */}
      {error && (
        <div className="mt-1 p-2 rounded-md bg-red-subtle border border-red text-red text-xs font-mono">
          {error.message}
        </div>
      )}
    </div>
  );
}
