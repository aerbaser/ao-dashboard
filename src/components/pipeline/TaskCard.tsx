import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TransitionError } from '../../lib/types';
import CopyButton from '../ui/CopyButton';
import FlowStrip from './FlowStrip';
import { ageColor } from '../../lib/age-color-css';

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

  // AWAITING_OWNER urgency: normal, urgent (>2h), overdue (>4h)
  const isAwaiting = task.state === 'AWAITING_OWNER';
  const awaitingMinutes = isAwaiting ? (task.age ?? 0) : 0;
  const isOverdue = isAwaiting && awaitingMinutes >= 240; // >4h
  const isUrgent = isAwaiting && !isOverdue && awaitingMinutes >= 120; // >2h

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        className={`
          bg-bg-surface border border-border-default rounded-md
          p-3 cursor-pointer min-h-[88px]
          hover:bg-bg-elevated transition-colors duration-100
          ${isActive ? 'animate-pulse-active' : ''}
          ${isCritical ? 'animate-pulse-critical' : ''}
          ${isAwaiting ? 'border-l-2' : ''}
          ${isOverdue ? 'border-l-red animate-pulse-critical' : ''}
          ${isUrgent ? 'border-l-amber animate-pulse-active ring-1 ring-amber/30' : ''}
          ${isAwaiting && !isUrgent && !isOverdue ? 'border-l-amber' : ''}
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

        {/* Flow Strip */}
        {(task.actors && task.actors.length > 0 || task.owner) && (
          <FlowStrip actors={task.actors ?? []} currentOwner={task.owner} />
        )}

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

          {/* Age badge with color signal */}
          {(() => {
            const color = ageColor(task.state, task.age);
            const ageTitle = color === 'text-red'
              ? `In ${task.state} for ${timeAgo(task.age)} — consider intervening`
              : undefined;
            return (
              <span
                className={`text-xs font-mono ml-auto ${color}`}
                title={ageTitle}
              >
                {task.age !== null ? timeAgo(task.age) : '—'}
              </span>
            );
          })()}
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
            <span
              title={`${task.retries} ${task.retries === 1 ? 'retry' : 'retries'}`}
              className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-amber-subtle text-amber font-mono text-xs cursor-help"
            >
              {task.retries}r
            </span>
          )}

          {/* Artifact icons */}
          <div className="flex items-center gap-1 ml-auto">
            {task.hasQuality && (
              <span className="text-xs text-emerald font-mono cursor-help" title="Quality gate passed">Q</span>
            )}
            {task.hasOutcome && (
              <span className="text-xs text-blue font-mono cursor-help" title="Outcome manifest">O</span>
            )}
            {task.hasRelease && (
              <span className="text-xs text-amber font-mono cursor-help" title="Release evidence">R</span>
            )}
          </div>
        </div>

        {/* Last agent message preview — AWAITING_OWNER only */}
        {task.state === 'AWAITING_OWNER' && task.lastAgentMessage && (
          <p className="text-xs text-text-secondary line-clamp-2 mt-2 border-l-2 border-amber pl-2">
            {task.lastAgentMessage}
          </p>
        )}

        {/* Awaiting Owner bar */}
        {task.state === 'AWAITING_OWNER' && (
          <div className="mt-1 px-2 py-1 rounded-sm bg-amber/10 text-amber text-xs font-medium">
            💬 Awaiting your input
          </div>
        )}
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
